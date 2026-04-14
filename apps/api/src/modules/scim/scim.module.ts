import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScimController } from './scim.controller';
import { ScimService } from './scim.service';
import { ScimAuthGuard } from './scim-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error(
            'JWT_SECRET must be set and at least 32 characters for SCIM module. ' +
              'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
          );
        }
        return {
          secret,
          signOptions: {
            algorithm: 'HS256' as const,
            audience: config.get<string>('JWT_AUDIENCE', 'privacyops-api'),
            issuer: config.get<string>('JWT_ISSUER', 'privacyops-auth'),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [ScimController],
  providers: [ScimService, ScimAuthGuard],
  exports: [ScimService],
})
export class ScimModule {}
