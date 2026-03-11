import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
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
    console.warn(
      '⚠ WARNING: Using weak JWT_SECRET. Set a strong 256-bit secret for production.',
    );
  }

  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());

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

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('TechD PrivacyOps API')
    .setDescription('Enterprise Privacy, DSPM & Data Governance Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`PrivacyOps API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
