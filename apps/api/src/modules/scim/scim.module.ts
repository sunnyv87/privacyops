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
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'dev-secret-change-in-production'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ScimController],
  providers: [ScimService, ScimAuthGuard],
  exports: [ScimService],
})
export class ScimModule {}
