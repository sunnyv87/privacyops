import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

/**
 * Global exception filter that:
 * 1. Logs structured JSON for every unhandled exception
 * 2. Includes correlationId + tenantId for traceability
 * 3. Returns a safe error response (no stack traces to clients)
 * 4. Classifies errors for downstream metrics / alerting
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const correlationId = (request as any).correlationId
      ?? CorrelationIdMiddleware.getCorrelationId();

    const tenantId = (request as any).user?.tenantId;

    // Structured error log
    this.logger.error({
      correlationId,
      tenantId,
      method: request.method,
      url: request.originalUrl,
      statusCode: status,
      errorType: exception instanceof HttpException ? 'http' : 'unhandled',
      message,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(status).json({
      statusCode: status,
      message: status === HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Internal server error'
        : message,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
