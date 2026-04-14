// OpenTelemetry MUST be initialised before any other imports
import { initTracing, shutdownTracing } from './core/telemetry/tracing';
initTracing();

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { StructuredLogger } from './core/telemetry/structured-logger.service';
import { CorrelationIdMiddleware } from './core/telemetry/correlation-id.middleware';
import { GlobalExceptionFilter } from './core/telemetry/global-exception.filter';

/**
 * Return a human-readable reason string when `secret` is unacceptable,
 * or `null` if it looks strong enough. Rejects: missing, short, known
 * template values, all-one-character strings, low character variety,
 * and the old `dev-secret` / `change-me` style placeholders that the
 * previous startup check used as substring sentinels.
 */
function validateJwtSecret(secret: string | undefined): string | null {
  if (!secret) return 'not set';
  if (secret.length < 32) return 'shorter than 32 characters';

  const lower = secret.toLowerCase();
  const BAD_SUBSTRINGS = [
    'change',
    'changeme',
    'change-me',
    'dev-secret',
    'dev_secret',
    'development',
    'example',
    'placeholder',
    'insecure',
    'secret-key',
    'replace',
    'default',
    'todo',
    'fixme',
    'test-secret',
  ];
  for (const bad of BAD_SUBSTRINGS) {
    if (lower.includes(bad)) return `contains forbidden token "${bad}"`;
  }

  const BAD_EXACT = new Set([
    'secret',
    'password',
    'jwt',
    'jwtsecret',
    'jwt-secret',
    'test',
    '123',
  ]);
  if (BAD_EXACT.has(lower)) return 'uses a template/default value';

  // Low-variety heuristic: require at least 12 distinct characters so
  // strings like 'aaaa…' or 'abcabcabc…' are rejected even if they
  // otherwise meet the length bar.
  const unique = new Set(secret).size;
  if (unique < 12) return `only ${unique} distinct characters`;

  return null;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate critical secrets at startup. The previous version relied on
  // `includes('change')` / `includes('dev-secret')` substring checks,
  // which fail open if the operator chooses any other weak value (e.g.
  // `secret`, `test`, `example`). Replace with an explicit blocklist and
  // a minimum-entropy heuristic so that any short, repeating, or known
  // template value is rejected up front.
  const jwtSecret = process.env.JWT_SECRET;
  const jwtSecretProblem = validateJwtSecret(jwtSecret);
  if (jwtSecretProblem) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`JWT_SECRET rejected: ${jwtSecretProblem}`);
    }
    logger.warn(
      `JWT_SECRET weak (${jwtSecretProblem}). Set a strong 256-bit secret for production.`,
    );
  }

  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(),
  });

  // Request size limits — reject oversized payloads before they reach
  // handlers. These caps apply globally to every JSON, URL-encoded, and
  // text request body parsed by express. Binary uploads are NOT accepted
  // directly by this API — Multer is intentionally absent from the
  // dependency graph; all large content moves through pre-signed S3 URLs
  // from signed-url.service.ts, so the direct request-body cap can stay
  // conservative.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));
  app.use(express.text({ limit: '256kb', type: ['text/*', 'application/xml'] }));

  // Security
  app.use(helmet());

  // Correlation ID middleware — must run before request logger
  const correlationMiddleware = new CorrelationIdMiddleware();
  app.use(correlationMiddleware.use.bind(correlationMiddleware));

  // Structured request logging
  const { RequestLoggerMiddleware } = await import(
    './core/security/request-logger.middleware'
  );
  const requestLogger = new RequestLoggerMiddleware();
  app.use(requestLogger.use.bind(requestLogger));

  // CORS — parse the env once, trim, drop empty entries. The previous
  // `split(',') || […]` pattern silently allowed an empty string as an
  // origin when CORS_ORIGINS was set to a trailing comma, which Chrome
  // reflects back as `Access-Control-Allow-Origin: null` and effectively
  // opens the API to sandboxed iframes. Filter before handing to Nest.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : ['http://localhost:3000'],
    credentials: true,
  });

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger — only enabled in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TechD PrivacyOps API')
      .setDescription('Enterprise Privacy, DSPM & Data Governance Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  const server = await app.listen(port);

  // Server-level socket timeout — kill connections that hang beyond 120s
  server.setTimeout(120_000);

  logger.log(`PrivacyOps API running on port ${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, shutting down...`);
      await app.close();
      await shutdownTracing();
      process.exit(0);
    });
  }
}

bootstrap();
