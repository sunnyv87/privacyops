import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class OidcStrategy extends PassportStrategy(OpenIDConnectStrategy, 'oidc') {
  private readonly logger = new Logger(OidcStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const baseUrl = config.get<string>('KEYCLOAK_BASE_URL');
    const realm = config.get<string>('KEYCLOAK_REALM');
    const issuer = `${baseUrl}/realms/${realm}`;

    super({
      issuer,
      authorizationURL: `${issuer}/protocol/openid-connect/auth`,
      tokenURL: `${issuer}/protocol/openid-connect/token`,
      userInfoURL: `${issuer}/protocol/openid-connect/userinfo`,
      clientID: config.get<string>('KEYCLOAK_CLIENT_ID'),
      clientSecret: config.get<string>('KEYCLOAK_CLIENT_SECRET'),
      callbackURL: '/api/v1/auth/oidc/callback',
      scope: 'openid profile email',
    });
  }

  async validate(
    issuer: string,
    profile: any,
    done: (err: any, user?: any) => void,
  ): Promise<void> {
    try {
      const email =
        profile.emails?.[0]?.value || profile._json?.email;
      const externalId = profile.id;
      const name =
        profile.displayName ||
        `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() ||
        email;

      if (!email) {
        return done(new Error('No email returned from OIDC provider'));
      }

      // Lookup by externalId first, then by email
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { externalId, authProvider: 'oidc' },
            { email },
          ],
        },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!user) {
        // Resolve tenant by email domain — never auto-assign to first tenant
        const emailDomain = email.split('@')[1]?.toLowerCase();
        if (!emailDomain) {
          return done(new Error('Invalid email address from OIDC provider'));
        }

        const tenant = await this.prisma.tenant.findFirst({
          where: { domain: emailDomain, status: 'active' },
        });

        if (!tenant) {
          this.logger.warn(
            `OIDC auto-provisioning denied: no active tenant with domain "${emailDomain}" for user ${email}`,
          );
          return done(new Error(`No tenant configured for domain "${emailDomain}". Contact your administrator.`));
        }

        user = await this.prisma.user.create({
          data: {
            tenantId: tenant.id,
            email,
            name,
            status: 'active',
            authProvider: 'oidc',
            externalId,
          },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });

        this.logger.log(`Provisioned new OIDC user: ${email} (${user.id})`);
      } else if (!user.externalId) {
        // Do NOT auto-link existing accounts by email — requires admin action
        // to prevent account takeover via OIDC provider email impersonation
        this.logger.warn(
          `OIDC login denied: user ${email} exists but is not linked to OIDC. Admin must link the account manually.`,
        );
        return done(new Error('Account exists but is not linked to OIDC. Contact your administrator to link your account.'));
      } else if (false) {
        // Kept for reference — manual linking should use a dedicated admin endpoint
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            externalId,
            authProvider: 'oidc',
          },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });
      }

      const roles = user.userRoles.map((ur: any) => ur.role.slug);
      const permissions = user.userRoles.flatMap(
        (ur: any) => ur.role.permissions || [],
      );

      const payload = {
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        roles,
        permissions,
      };

      done(null, payload);
    } catch (error) {
      this.logger.error('OIDC validation error', error);
      done(error);
    }
  }
}
