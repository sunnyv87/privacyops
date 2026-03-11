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
    const whereClause: any = { email };

    // If tenantSlug provided, resolve tenant first
    if (tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: tenantSlug },
      });
      if (!tenant) {
        throw new UnauthorizedException('Invalid credentials');
      }
      whereClause.tenantId = tenant.id;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        ...whereClause,
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

  generateTokens(
    payload: JwtPayload,
    sessionId: string,
  ): { accessToken: string; refreshToken: string } {
    const accessTokenPayload = { ...payload, sid: sessionId };
    const refreshTokenPayload = {
      sub: payload.sub,
      tenantId: payload.tenantId,
      sid: sessionId,
      type: 'refresh',
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
  ): Promise<{ sub: string; tenantId: string; sid: string }> {
    const payload = this.verifyToken(token);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    if (!payload.sid) {
      throw new UnauthorizedException('Token missing session reference');
    }

    // Verify session still exists in Redis
    const session = await this.sessionService.getSession(payload.sid);
    if (!session) {
      throw new UnauthorizedException('Session has been revoked');
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
