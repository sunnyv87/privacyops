import { Module, DynamicModule, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './services/session.service';
import { MfaService } from './services/mfa.service';
import { RateLimitGuard } from './guards/rate-limit.guard';

const REDIS_PROVIDER = {
  provide: 'REDIS_CLIENT',
  useFactory: (config: ConfigService): Redis => {
    const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
    const logger = new Logger('RedisProvider');

    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      lazyConnect: false,
    });

    client.on('error', (err) => {
      logger.error('Redis connection error', err.message);
    });

    client.on('connect', () => {
      logger.log('Redis connected');
    });

    return client;
  },
  inject: [ConfigService],
};

@Module({})
export class AuthModule {
  private static readonly logger = new Logger(AuthModule.name);

  static register(): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => ({
            secret: config.get(
              'JWT_SECRET',
              'dev-secret-change-in-production',
            ),
            signOptions: { expiresIn: '15m' },
          }),
          inject: [ConfigService],
        }),
        ConfigModule,
      ],
      providers: [
        REDIS_PROVIDER,
        JwtStrategy,
        AuthService,
        SessionService,
        MfaService,
        RateLimitGuard,
        // Conditionally loaded strategies are registered in onModuleInit
        ...AuthModule.getConditionalStrategies(),
      ],
      controllers: [AuthController],
      exports: [AuthService, SessionService, JwtModule, 'REDIS_CLIENT'],
    };
  }

  private static getConditionalStrategies(): any[] {
    const strategies: any[] = [];

    // OIDC strategy — always register; it will fail gracefully if env vars are missing
    try {
      const { OidcStrategy } = require('./strategies/oidc.strategy');
      strategies.push(OidcStrategy);
    } catch {
      AuthModule.logger.warn(
        'OIDC strategy could not be loaded — Keycloak SSO disabled',
      );
    }

    // SAML strategy — only register if SAML_ENTRY_POINT is configured
    if (process.env.SAML_ENTRY_POINT) {
      try {
        const { SamlStrategyProvider } = require('./strategies/saml.strategy');
        strategies.push(SamlStrategyProvider);
      } catch {
        AuthModule.logger.warn(
          'SAML strategy could not be loaded — SAML SSO disabled',
        );
      }
    }

    return strategies;
  }
}
