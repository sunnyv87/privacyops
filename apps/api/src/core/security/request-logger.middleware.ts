import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '-';

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const tenantId = (req as any).user?.tenantId || '-';
      const userId = (req as any).user?.id || '-';
      const correlationId = (req as any).correlationId || '-';

      const logEntry = {
        method,
        url: originalUrl,
        statusCode,
        duration,
        ip,
        userAgent,
        tenantId,
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      };

      if (statusCode >= 500) {
        this.logger.error(logEntry);
      } else if (statusCode >= 400) {
        this.logger.warn(logEntry);
      } else {
        this.logger.log(logEntry);
      }
    });

    next();
  }
}
