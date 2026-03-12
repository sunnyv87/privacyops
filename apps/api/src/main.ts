// OpenTelemetry MUST be initialised before any other imports
import { initTracing, shutdownTracing } from './core/telemetry/tracing';
initTracing();

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { StructuredLogger } from './core/telemetry/structured-logger.service';
import { CorrelationIdMiddleware } from './core/telemetry/correlation-id.middleware';
import { GlobalExceptionFilter } from './core/telemetry/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate critical secrets at startup
  const jwtSecret = process.env.JWT_SECRET;
  if (
    !jwtSecret ||
    jwtSecret.length < 32 ||
    jwtSecret.includes('change') ||
    jwtSecret.includes('dev-secret')
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET must be at least 32 characters and not a default value in production',
      );
    }
    logger.warn(
      'Using weak JWT_SECRET. Set a strong 256-bit secret for production.',
    );
  }

  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(),
  });

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

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
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
  await app.listen(port);
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
