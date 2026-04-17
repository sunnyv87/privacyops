import { IsNotEmpty, IsString, IsUrl, Matches, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'isSameOriginUrl', async: false })
class IsSameOriginUrl implements ValidatorConstraintInterface {
  validate(value: string, _args: ValidationArguments) {
    try {
      const parsed = new URL(value);
      const allowedOrigin = process.env.APP_URL || process.env.FRONTEND_URL;
      if (!allowedOrigin) return true;
      const allowed = new URL(allowedOrigin);
      return parsed.origin === allowed.origin;
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'URL must match the application origin';
  }
}

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
  @Validate(IsSameOriginUrl)
  successUrl!: string;

  @IsUrl({ require_tld: false })
  @Validate(IsSameOriginUrl)
  cancelUrl!: string;
}
