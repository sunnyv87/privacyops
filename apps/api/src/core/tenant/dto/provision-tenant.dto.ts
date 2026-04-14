import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Request body for POST /tenants (platform admin only). All fields are
 * validated at the class-validator layer; additional business-rule checks
 * live in TenantService.validateProvisionInput.
 */
export class ProvisionTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,63}$/, {
    message: 'slug must be lowercase alphanumeric with dashes, 3-63 chars',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dataResidencyRegion!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  adminName!: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  adminPassword?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]{1,50}$/, { message: 'planCode must be lowercase alphanumeric' })
  planCode?: string;
}
