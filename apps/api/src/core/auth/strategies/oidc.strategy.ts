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
      // PKCE protection against authorization-code interception.
      pkce: true,
      state: true,
    } as any);
  }

  async validate(
    issuer: string,
    profile: any,
    done: (err: any, user?: any) => void,
  ): Promise<void> {
    try {
      const email =
        profile.emails?.[0]?.value || profile._json?.email;
      const emailVerified =
        profile._json?.email_verified === true ||
        profile._json?.email_verified === 'true';
      const externalId = profile.id;
      const name =
        profile.displayName ||
        `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() ||
        email;

      if (!email) {
        return done(new Error('No email returned from OIDC provider'));
      }

      // Require the IdP to assert the email is verified — otherwise an
      // attacker who controls an IdP account with an arbitrary email claim
      // could take over an existing PrivacyOps account via email collision.
      if (!emailVerified) {
        this.logger.warn(
          `OIDC login denied: email not verified by IdP for subject ${externalId}`,
        );
        return done(
          new Error(
            'Email address is not verified by your identity provider. Contact your administrator.',
          ),
        );
      }

      if (!externalId) {
        return done(new Error('OIDC provider did not return a subject identifier'));
      }

      // Resolve tenant deterministically from the email domain BEFORE any
      // user lookup. This ensures that all queries are tenant-scoped and
      // prevents cross-tenant account matching via duplicate email.
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (!emailDomain) {
        return done(new Error('Invalid email address from OIDC provider'));
      }

      const tenant = await this.prisma.tenant.findFirst({
        where: { domain: emailDomain, status: 'active' },
        select: { id: true },
      });

      if (!tenant) {
        this.logger.warn(
          `OIDC login denied: no active tenant with domain for subject ${externalId}`,
        );
        return done(
          new Error(
            'No tenant is configured for your email domain. Contact your administrator.',
          ),
        );
      }

      // Lookup by (externalId, authProvider, tenantId) only. Never match by
      // email — otherwise an IdP compromise lets an attacker hijack any
      // existing PrivacyOps account whose email matches the IdP claim.
      let user = await this.prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          externalId,
          authProvider: 'oidc',
        },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!user) {
        // Check whether a local account with this email already exists in
        // the tenant — if so, refuse auto-link and require manual admin
        // linking to prevent takeover.
        const conflict = await this.prisma.user.findFirst({
          where: { tenantId: tenant.id, email },
          select: { id: true, authProvider: true },
        });

        if (conflict) {
          this.logger.warn(
            `OIDC login denied: user with subject ${externalId} collides with existing local account in tenant ${tenant.id}`,
          );
          return done(
            new Error(
              'An account with this email already exists. Contact your administrator to link your SSO account.',
            ),
          );
        }

        user = await this.prisma.user.create({
          data: {
            tenantId: tenant.id,
            email,
            name,
            isActive: true,
            authProvider: 'oidc',
            externalId,
          },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });

        this.logger.log({
          message: 'OIDC user provisioned',
          subject: externalId,
          tenantId: tenant.id,
          userId: user.id,
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
