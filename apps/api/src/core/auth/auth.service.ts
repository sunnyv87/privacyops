import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './services/session.service';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

export interface JwtPayload {
  sub: string; // user ID
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sid?: string; // session ID
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async validateUser(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException();
    }

    return user;
  }

  async validateCredentials(
    email: string,
    password: string,
    tenantSlug?: string,
  ): Promise<any> {
    // Tenant scope is mandatory. Without it, a user whose email happens to
    // collide with a user in another tenant could authenticate into the
    // wrong tenant — the previous behaviour of `findFirst` returning a
    // non-deterministic row was a cross-tenant confused-deputy bug.
    if (!tenantSlug || typeof tenantSlug !== 'string' || tenantSlug.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, status: true },
    });
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email,
        authProvider: 'local',
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new ForbiddenException('Account is not active');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new ForbiddenException(
        `Account is locked. Try again in ${remainingMin} minute(s).`,
      );
    }

    // Verify password
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Successful credential validation
    await this.handleSuccessfulLogin(user.id);

    return user;
  }

  async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true },
    });

    const newAttempts = (user?.failedLoginAttempts || 0) + 1;
    const updateData: any = { failedLoginAttempts: newAttempts };

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(
        Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000,
      );
      this.logger.warn(
        `User ${userId} locked out after ${newAttempts} failed login attempts`,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async handleSuccessfulLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Produces a short-lived device fingerprint hash from the client IP and
   * User-Agent. A refresh token is bound to this fingerprint so it cannot
   * be replayed from an unrelated host.
   */
  static deviceFingerprint(ip: string, userAgent: string): string {
    const salt = process.env.DEVICE_BINDING_SALT || 'privacyops-dev-binding';
    return createHash('sha256')
      .update(`${ip}|${userAgent}|${salt}`)
      .digest('hex')
      .slice(0, 32);
  }

  generateTokens(
    payload: JwtPayload,
    sessionId: string,
    deviceFingerprint?: string,
  ): { accessToken: string; refreshToken: string } {
    const accessTokenPayload = { ...payload, sid: sessionId };
    const refreshTokenPayload = {
      sub: payload.sub,
      tenantId: payload.tenantId,
      sid: sessionId,
      type: 'refresh',
      ...(deviceFingerprint ? { dfp: deviceFingerprint } : {}),
    };

    const accessToken = this.jwt.sign(accessTokenPayload, {
      expiresIn: '15m',
    });
    const refreshToken = this.jwt.sign(refreshTokenPayload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  verifyToken(token: string): any {
    try {
      return this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async validateRefreshToken(
    token: string,
    requestFingerprint: string,
  ): Promise<{ sub: string; tenantId: string; sid: string }> {
    const payload = this.verifyToken(token);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    if (!payload.sid) {
      throw new UnauthorizedException('Token missing session reference');
    }

    // Refresh tokens issued before device binding existed are rejected —
    // the user must re-authenticate to obtain a bound token.
    if (!payload.dfp) {
      throw new UnauthorizedException('Refresh token missing device binding');
    }

    if (payload.dfp !== requestFingerprint) {
      // Reuse-family kill: a fingerprint mismatch is the strongest signal of
      // token theft. Revoke the entire session chain and force re-auth.
      await this.sessionService.revokeSession(payload.sid);
      this.logger.warn(
        `Refresh token device binding mismatch for session ${payload.sid} — session revoked`,
      );
      throw new UnauthorizedException('Refresh token rejected: device mismatch');
    }

    // Verify session still exists in Redis
    const session = await this.sessionService.getSession(payload.sid);
    if (!session) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // Additional defense: session must belong to the claimed subject.
    if (session.userId && session.userId !== payload.sub) {
      await this.sessionService.revokeSession(payload.sid);
      throw new UnauthorizedException('Session/subject mismatch');
    }

    return { sub: payload.sub, tenantId: payload.tenantId, sid: payload.sid };
  }

  async rotateRefreshToken(
    oldSessionId: string,
    userId: string,
    tenantId: string,
    metadata: { ip: string; userAgent: string; provider: string },
  ): Promise<string> {
    // Revoke old session
    await this.sessionService.revokeSession(oldSessionId);

    // Create new session
    const newSessionId = await this.sessionService.createSession(
      userId,
      tenantId,
      metadata,
    );

    return newSessionId;
  }

  generateMfaPendingToken(userId: string, tenantId: string): string {
    return this.jwt.sign(
      { sub: userId, tenantId, type: 'mfa_pending' },
      { expiresIn: '5m' },
    );
  }

  buildPayloadFromUser(user: any): JwtPayload {
    const roles = user.userRoles.map((ur: any) => ur.role.slug);
    const permissions = user.userRoles.flatMap(
      (ur: any) => ur.role.permissions || [],
    );

    return {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions,
    };
  }
}
