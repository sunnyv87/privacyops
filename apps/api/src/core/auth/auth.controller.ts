import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for JWT tokens' })
  async getToken(@Body() body: { email: string; password: string }) {
    // In production, this would validate against Keycloak.
    // For development, use a simple lookup.
    // TODO: Implement Keycloak OIDC flow
    throw new Error('Implement Keycloak authentication');
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() body: { refreshToken: string }) {
    const payload = this.authService.verifyToken(body.refreshToken);
    const user = await this.authService.validateUser(payload.sub);

    const permissions = user.userRoles.flatMap(
      (ur: any) => ur.role.permissions || [],
    );

    return this.authService.generateTokens({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: user.userRoles.map((ur: any) => ur.role.slug),
      permissions,
    });
  }
}
