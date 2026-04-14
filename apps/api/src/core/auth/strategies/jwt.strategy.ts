import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';
import { SessionService } from '../services/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    const jwtSecret = config.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET environment variable is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      algorithms: ['HS256'],
      audience: config.get<string>('JWT_AUDIENCE', 'privacyops-api'),
      issuer: config.get<string>('JWT_ISSUER', 'privacyops-auth'),
    });
  }

  async validate(payload: JwtPayload & { sid?: string }) {
    // Every access token MUST carry a session ID so that revocation works.
    // A token without a sid is either legacy (we have no such tokens in
    // production) or forged — reject it. This closes the
    // revocation-bypass hole where stolen tokens remained valid for 15m
    // even after explicit logout.
    if (!payload.sid) {
      throw new UnauthorizedException('Malformed authentication token');
    }

    const session = await this.sessionService.getSession(payload.sid);
    if (!session) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // Extra defense: the session must belong to the subject claimed in the
    // JWT. A leaked session ID paired with a different JWT subject is a
    // token-swapping attack attempt.
    if (session.userId && session.userId !== payload.sub) {
      throw new UnauthorizedException('Session/subject mismatch');
    }

    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      sid: payload.sid,
    };
  }
}
