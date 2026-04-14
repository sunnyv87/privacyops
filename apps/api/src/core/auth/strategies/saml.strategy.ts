import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import {
  Strategy as SamlStrategy,
  Profile as SamlProfile,
  VerifiedCallback,
} from '@node-saml/passport-saml';
import { PrismaService } from '@/core/prisma/prisma.service';

@Injectable()
export class SamlStrategyProvider extends PassportStrategy(SamlStrategy, 'saml') {
  private readonly logger = new Logger(SamlStrategyProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      entryPoint: config.get<string>('SAML_ENTRY_POINT'),
      issuer: config.get<string>('SAML_ISSUER', 'privacyops-sp'),
      cert: config.get<string>('SAML_CERT', ''),
      callbackUrl: config.get<string>(
        'SAML_CALLBACK_URL',
        '/api/v1/auth/saml/callback',
      ),
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      // Require signed logout requests — prevents unauthenticated logout.
      wantLogoutRequestsSigned: true,
      // Disable signature wrapping attack vectors.
      disableRequestedAuthnContext: false,
      // Enforce audience restriction validation.
      audience: config.get<string>('SAML_AUDIENCE', 'privacyops-sp'),
    });
  }

  async validate(
    profile: SamlProfile,
    done: VerifiedCallback,
  ): Promise<void> {
    try {
      const nameID = profile.nameID;
      const email =
        profile.email ||
        (profile as any)['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
        nameID;
      const name =
        profile.displayName ||
        (profile as any)['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
        email;

      if (!nameID) {
        return done(new Error('No nameID in SAML assertion'));
      }

      if (!email || typeof email !== 'string') {
        return done(new Error('No email in SAML assertion'));
      }

      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (!emailDomain) {
        return done(new Error('Invalid email address from SAML assertion'));
      }

      // Resolve tenant deterministically BEFORE any user lookup so that every
      // query is tenant-scoped and cross-tenant matching is impossible.
      const tenant = await this.prisma.tenant.findFirst({
        where: { domain: emailDomain, status: 'active' },
        select: { id: true },
      });

      if (!tenant) {
        this.logger.warn(
          `SAML login denied: no active tenant for subject ${nameID}`,
        );
        return done(
          new Error(
            'No tenant is configured for your email domain. Contact your administrator.',
          ),
        );
      }

      // Lookup strictly by (externalId, authProvider, tenantId). Never match
      // by email — otherwise a compromised SAML IdP could assert any email
      // and take over existing accounts.
      let user = await this.prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          externalId: nameID,
          authProvider: 'saml',
        },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!user) {
        const conflict = await this.prisma.user.findFirst({
          where: { tenantId: tenant.id, email },
          select: { id: true },
        });

        if (conflict) {
          this.logger.warn(
            `SAML login denied: subject ${nameID} collides with existing local account in tenant ${tenant.id}`,
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
            authProvider: 'saml',
            externalId: nameID,
          },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });

        this.logger.log({
          message: 'SAML user provisioned',
          subject: nameID,
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
      this.logger.error('SAML validation error', error);
      done(error);
    }
  }
}
