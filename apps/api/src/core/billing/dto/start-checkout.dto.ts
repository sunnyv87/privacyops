import { IsNotEmpty, IsString, IsUrl, Matches } from 'class-validator';

export class StartCheckoutDto {
  /**
   * Plan code to purchase. Must match a row in the `plans` table.
   * Restricted to lowercase alnum + underscore to stop injection into
   * provider metadata.
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_]{1,50}$/, { message: 'planCode must be lowercase alphanumeric' })
  planCode!: string;

  @IsUrl({ require_tld: false })
  successUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}
