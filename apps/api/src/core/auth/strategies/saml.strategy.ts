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

      // Lookup by externalId (nameID) or email
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { externalId: nameID, authProvider: 'saml' },
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
          return done(new Error('Invalid email address from SAML assertion'));
        }

        const tenant = await this.prisma.tenant.findFirst({
          where: { domain: emailDomain, status: 'active' },
        });

        if (!tenant) {
          this.logger.warn(
            `SAML auto-provisioning denied: no active tenant with domain "${emailDomain}" for user ${email}`,
          );
          return done(new Error(`No tenant configured for domain "${emailDomain}". Contact your administrator.`));
        }

        user = await this.prisma.user.create({
          data: {
            tenantId: tenant.id,
            email,
            name,
            status: 'active',
            authProvider: 'saml',
            externalId: nameID,
          },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });

        this.logger.log(`Provisioned new SAML user: ${email} (${user.id})`);
      } else if (!user.externalId) {
        // Do NOT auto-link existing accounts by email — requires admin action
        this.logger.warn(
          `SAML login denied: user ${email} exists but is not linked to SAML. Admin must link the account manually.`,
        );
        return done(new Error('Account exists but is not linked to SAML. Contact your administrator to link your account.'));
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
