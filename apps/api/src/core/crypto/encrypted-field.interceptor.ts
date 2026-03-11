import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CryptoService } from './crypto.service';
import { PrismaService } from '@/core/prisma/prisma.service';

// ── Decorator metadata key ────────────────────────────────────────

export const ENCRYPTED_FIELDS_KEY = 'encryptedFields';

export interface EncryptedFieldConfig {
  /** The entity type (for logging / debugging) */
  entityType: string;
  /** Dot-notated field paths to encrypt/decrypt (e.g., 'connectionConfig', 'requestorInfo') */
  fields: string[];
}

/**
 * Decorator to mark which fields on a controller method should be
 * transparently encrypted (request body) and decrypted (response body).
 */
export const EncryptFields = (config: EncryptedFieldConfig) =>
  SetMetadata(ENCRYPTED_FIELDS_KEY, config);

// ── Interceptor ───────────────────────────────────────────────────

@Injectable()
export class EncryptedFieldInterceptor implements NestInterceptor {
  private readonly logger = new Logger(EncryptedFieldInterceptor.name);

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const config = this.reflector.get<EncryptedFieldConfig>(
      ENCRYPTED_FIELDS_KEY,
      context.getHandler(),
    );

    // If no @EncryptFields decorator, pass through
    if (!config) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;

    if (!tenantId) {
      // No tenant context — cannot encrypt/decrypt, pass through
      return next.handle();
    }

    // Resolve the tenant's encryption key ID
    const encryptionKeyId = await this.resolveTenantKeyId(tenantId);
    if (!encryptionKeyId) {
      this.logger.warn(
        `No encryption key ID found for tenant ${tenantId}; skipping field encryption`,
      );
      return next.handle();
    }

    // ── Encrypt fields in request body ──────────────────────────
    if (request.body && typeof request.body === 'object') {
      await this.encryptFields(request.body, config.fields, encryptionKeyId);
    }

    // ── Decrypt fields in response ──────────────────────────────
    return next.handle().pipe(
      map(async (responseData) => {
        if (!responseData) return responseData;
        const data = await responseData;
        await this.decryptResponseFields(data, config.fields, encryptionKeyId);
        return data;
      }),
      // Unwrap the inner promise created by the async map
      map((val) => val),
    );
  }

  /**
   * Resolve a tenant's encryption key ID from the database.
   */
  private async resolveTenantKeyId(
    tenantId: string,
  ): Promise<string | null> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { encryptionKeyId: true },
      });
      return tenant?.encryptionKeyId ?? null;
    } catch (err) {
      this.logger.error(
        `Failed to resolve encryption key for tenant ${tenantId}`,
        err,
      );
      return null;
    }
  }

  /**
   * Encrypt specific fields in an object (mutates in place).
   */
  private async encryptFields(
    obj: Record<string, any>,
    fieldPaths: string[],
    keyId: string,
  ): Promise<void> {
    for (const fieldPath of fieldPaths) {
      const { parent, key } = this.resolveFieldPath(obj, fieldPath);
      if (parent === null || parent[key] === undefined || parent[key] === null) {
        continue;
      }

      const value = parent[key];
      try {
        if (typeof value === 'string') {
          // Already a string — encrypt directly
          parent[key] = await this.cryptoService.encrypt(value, keyId);
        } else if (typeof value === 'object') {
          // JSON object — serialize then encrypt
          parent[key] = await this.cryptoService.encryptJson(value, keyId);
        }
      } catch (err) {
        this.logger.error(`Failed to encrypt field "${fieldPath}"`, err);
        throw err;
      }
    }
  }

  /**
   * Decrypt specific fields in a response object or array (mutates in place).
   */
  private async decryptResponseFields(
    data: any,
    fieldPaths: string[],
    keyId: string,
  ): Promise<void> {
    if (Array.isArray(data)) {
      for (const item of data) {
        await this.decryptResponseFields(item, fieldPaths, keyId);
      }
      return;
    }

    // Handle paginated responses with a `data` array
    if (data && typeof data === 'object' && Array.isArray(data.data)) {
      for (const item of data.data) {
        await this.decryptResponseFields(item, fieldPaths, keyId);
      }
      return;
    }

    if (!data || typeof data !== 'object') return;

    for (const fieldPath of fieldPaths) {
      const { parent, key } = this.resolveFieldPath(data, fieldPath);
      if (parent === null || parent[key] === undefined || parent[key] === null) {
        continue;
      }

      const value = parent[key];
      if (typeof value !== 'string') continue;

      // Only attempt decryption if the value matches our envelope format (4 base64 parts)
      if (!this.looksEncrypted(value)) continue;

      try {
        // Try JSON decryption first, fall back to string decryption
        try {
          parent[key] = await this.cryptoService.decryptJson(value, keyId);
        } catch {
          parent[key] = await this.cryptoService.decrypt(value, keyId);
        }
      } catch (err) {
        this.logger.error(`Failed to decrypt field "${fieldPath}"`, err);
        // Leave the field as-is rather than throwing — allows partial decryption
      }
    }
  }

  /**
   * Check if a string value looks like our encrypted envelope format.
   * Format: {base64}:{base64}:{base64}:{base64}
   */
  private looksEncrypted(value: string): boolean {
    const parts = value.split(':');
    if (parts.length !== 4) return false;
    const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
    return parts.every((part) => base64Pattern.test(part));
  }

  /**
   * Resolve a dot-notated field path to its parent object and final key.
   * e.g., "nested.field" on { nested: { field: 'value' } }
   * returns { parent: { field: 'value' }, key: 'field' }
   */
  private resolveFieldPath(
    obj: Record<string, any>,
    path: string,
  ): { parent: Record<string, any> | null; key: string } {
    const segments = path.split('.');
    let current: any = obj;

    for (let i = 0; i < segments.length - 1; i++) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return { parent: null, key: '' };
      }
      current = current[segments[i]];
    }

    if (current === null || current === undefined || typeof current !== 'object') {
      return { parent: null, key: '' };
    }

    return { parent: current, key: segments[segments.length - 1] };
  }
}
