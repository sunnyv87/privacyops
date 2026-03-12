import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

/**
 * Correlation context propagated through AsyncLocalStorage for the lifetime
 * of a single inbound request.  Any code running inside the request can call
 * `CorrelationIdMiddleware.getCorrelationId()` to retrieve the current ID
 * without needing access to the Express `Request` object.
 */
export interface RequestContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  /** Header used for external correlation – propagated by API gateways / LBs. */
  static readonly HEADER = 'x-request-id';

  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers[CorrelationIdMiddleware.HEADER] as string) || randomUUID();

    // Make it available on the request object for downstream middleware/guards
    (req as any).correlationId = correlationId;

    // Echo back so callers can correlate client-side
    res.setHeader(CorrelationIdMiddleware.HEADER, correlationId);

    const ctx: RequestContext = {
      correlationId,
      tenantId: (req as any).user?.tenantId,
      userId: (req as any).user?.id,
    };

    storage.run(ctx, () => next());
  }

  /** Retrieve the current request context (if any). */
  static getContext(): RequestContext | undefined {
    return storage.getStore();
  }

  /** Shorthand: get just the correlation ID, or a fallback. */
  static getCorrelationId(): string {
    return storage.getStore()?.correlationId ?? 'no-context';
  }
}
