import { LoggerService, LogLevel } from '@nestjs/common';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

/**
 * Sensitive field patterns reused from AuditService — applied to all structured
 * log output to prevent credential / PII leakage in operational logs.
 */
const SENSITIVE_PATTERNS = [
  /password/i, /secret/i, /token/i, /apiKey/i, /api_key/i,
  /credential/i, /ssn/i, /social_security/i, /credit_card/i,
  /creditCard/i, /cvv/i, /pin/i, /private_key/i, /privateKey/i,
  /mfaSecret/i, /mfa_secret/i, /mfaRecoveryCodes/i, /recovery_codes/i,
  /refreshToken/i, /refresh_token/i, /accessToken/i, /access_token/i,
  /authorization/i,
];

const REDACTED = '[REDACTED]';

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Error) {
    return { message: obj.message, stack: obj.stack };
  }
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_PATTERNS.some((p) => p.test(key))) {
      clean[key] = REDACTED;
    } else {
      clean[key] = typeof value === 'object' ? redact(value, depth + 1) : value;
    }
  }
  return clean;
}

/**
 * Drop-in NestJS LoggerService that outputs newline-delimited JSON to stdout.
 *
 * Every log entry automatically includes:
 * - correlationId (from AsyncLocalStorage)
 * - tenantId / userId (when available)
 * - ISO-8601 timestamp
 * - service (logger context)
 *
 * Sensitive fields in any logged objects are automatically redacted.
 *
 * Backward compatible: NestJS Logger calls (this.logger.log / .warn / .error)
 * are routed here when configured in main.ts via `app.useLogger(...)`.
 */
export class StructuredLogger implements LoggerService {
  private readonly level: number;

  private static readonly LEVELS: Record<string, number> = {
    verbose: 0,
    debug: 1,
    log: 2,
    warn: 3,
    error: 4,
  };

  constructor() {
    const envLevel = (process.env.LOG_LEVEL ?? 'log').toLowerCase();
    this.level = StructuredLogger.LEVELS[envLevel] ?? 2;
  }

  log(message: any, ...optionalParams: any[]) {
    this.emit('log', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.emit('error', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.emit('warn', message, optionalParams);
  }

  debug?(message: any, ...optionalParams: any[]) {
    this.emit('debug', message, optionalParams);
  }

  verbose?(message: any, ...optionalParams: any[]) {
    this.emit('verbose', message, optionalParams);
  }

  setLogLevels?(_levels: LogLevel[]) {
    // no-op — controlled by LOG_LEVEL env var
  }

  private emit(level: string, message: any, params: any[]) {
    if ((StructuredLogger.LEVELS[level] ?? 2) < this.level) return;

    // NestJS passes the context (class name) as the last optional param
    const context = typeof params[params.length - 1] === 'string'
      ? params[params.length - 1]
      : undefined;

    const reqCtx = CorrelationIdMiddleware.getContext();

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: context ?? 'Application',
      correlationId: reqCtx?.correlationId,
      tenantId: reqCtx?.tenantId,
      userId: reqCtx?.userId,
      message: typeof message === 'string' ? message : undefined,
    };

    // If message is an object (e.g. JSON.stringify'd log entry from request-logger)
    // merge it into the top-level entry to keep logs flat and parseable.
    if (typeof message === 'object' && message !== null) {
      Object.assign(entry, redact(message));
    }

    // Attach error stack if the first optionalParam is an Error or a string trace
    const trace = params[0];
    if (trace instanceof Error) {
      entry.error = { message: trace.message, stack: trace.stack };
    } else if (typeof trace === 'string' && trace.includes('\n')) {
      entry.stack = trace;
    }

    // Remove undefined keys to keep output clean
    for (const k of Object.keys(entry)) {
      if (entry[k] === undefined) delete entry[k];
    }

    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}
