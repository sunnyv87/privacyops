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

    // Build the client-visible body. HttpException carries a structured
    // response via `.getResponse()`; we only forward its sanctioned
    // shape and never stringify raw error messages from non-HTTP
    // exceptions (which may contain Prisma/ORM internals, stack frames,
    // or third-party SDK diagnostics).
    let clientBody: Record<string, any>;
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        clientBody = { statusCode: status, message: exceptionResponse };
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        clientBody = { ...(exceptionResponse as Record<string, any>) };
      } else {
        clientBody = { statusCode: status, message: exception.message };
      }
    } else {
      clientBody = { statusCode: status, message: 'Internal server error' };
    }

    const correlationId =
      (request as any).correlationId
      ?? CorrelationIdMiddleware.getCorrelationId();

    const tenantId = (request as any).user?.tenantId;

    // Structured error log — the server-side record keeps the full
    // exception message and stack for debugging; nothing from the
    // non-HTTP branch is forwarded to the client.
    this.logger.error({
      correlationId,
      tenantId,
      method: request.method,
      url: this.scrubUrl(request.originalUrl),
      statusCode: status,
      errorType: exception instanceof HttpException ? 'http' : 'unhandled',
      message: exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(status).json({
      ...clientBody,
      statusCode: status,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Drop the query string from logged URLs — it may contain signed
   * download links, magic-link tokens, or DSAR lookup parameters.
   */
  private scrubUrl(url: string): string {
    const q = url.indexOf('?');
    return q === -1 ? url : `${url.slice(0, q)}?…`;
  }
}
