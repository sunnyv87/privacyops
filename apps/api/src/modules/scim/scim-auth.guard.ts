import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';

/**
 * Guard for SCIM 2.0 endpoints.
 * Accepts either:
 * 1. A SCIM bearer token via `X-SCIM-Token` header (hashed and looked up in scim_tokens table)
 * 2. A standard JWT Bearer token in the Authorization header
 *
 * On success, attaches `tenantId` and a synthetic user to request.
 */
@Injectable()
export class ScimAuthGuard implements CanActivate {
  private readonly logger = new Logger(ScimAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Try X-SCIM-Token header first
    const scimToken = request.headers['x-scim-token'];
    if (scimToken) {
      return this.validateScimToken(request, scimToken);
    }

    // 2. Try standard Authorization Bearer token
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Try as SCIM token first, then as JWT
      const isScim = await this.tryScimToken(request, token);
      if (isScim) return true;

      return this.validateJwtToken(request, token);
    }

    throw new UnauthorizedException('SCIM authentication required');
  }

  private async validateScimToken(
    request: any,
    token: string,
  ): Promise<boolean> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const scimToken = await this.prisma.scimToken.findFirst({
      where: {
        tokenHash,
        isActive: true,
      },
    });

    if (!scimToken) {
      throw new UnauthorizedException('Invalid SCIM token');
    }

    // Update last used timestamp
    await this.prisma.scimToken.update({
      where: { id: scimToken.id },
      data: { lastUsedAt: new Date() },
    });

    // Set tenant context for RLS
    await this.prisma.setTenantContext(scimToken.tenantId);

    // Attach tenant and synthetic user to request
    request.tenantId = scimToken.tenantId;
    request.user = {
      id: scimToken.createdBy,
      tenantId: scimToken.tenantId,
      isScimClient: true,
    };

    return true;
  }

  private async tryScimToken(
    request: any,
    token: string,
  ): Promise<boolean> {
    try {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const scimToken = await this.prisma.scimToken.findFirst({
        where: { tokenHash, isActive: true },
      });

      if (scimToken) {
        await this.prisma.scimToken.update({
          where: { id: scimToken.id },
          data: { lastUsedAt: new Date() },
        });

        await this.prisma.setTenantContext(scimToken.tenantId);

        request.tenantId = scimToken.tenantId;
        request.user = {
          id: scimToken.createdBy,
          tenantId: scimToken.tenantId,
          isScimClient: true,
        };
        return true;
      }
    } catch {
      // Not a SCIM token, fall through to JWT
    }
    return false;
  }

  private async validateJwtToken(
    request: any,
    token: string,
  ): Promise<boolean> {
    try {
      const payload = this.jwtService.verify(token);

      if (!payload.sub || !payload.tenantId) {
        throw new UnauthorizedException('Invalid JWT payload for SCIM');
      }

      await this.prisma.setTenantContext(payload.tenantId);

      request.tenantId = payload.tenantId;
      request.user = {
        id: payload.sub,
        tenantId: payload.tenantId,
        email: payload.email,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.debug(`JWT validation failed: ${error}`);
      throw new UnauthorizedException('Invalid authentication token');
    }
  }
}
