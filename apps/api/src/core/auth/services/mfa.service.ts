import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class MfaService {
  private readonly APP_NAME = 'TechD PrivacyOps';

  async generateSecret(
    email: string,
  ): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, this.APP_NAME, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  verifyToken(secret: string, token: string): boolean {
    return authenticator.verify({ token, secret });
  }

  generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push(randomBytes(4).toString('hex'));
    }
    return codes;
  }

  verifyRecoveryCode(
    storedCodes: string[],
    code: string,
  ): { valid: boolean; remaining: string[] } {
    const normalizedCode = code.toLowerCase().trim();
    const index = storedCodes.findIndex(
      (stored) => stored.toLowerCase() === normalizedCode,
    );

    if (index === -1) {
      return { valid: false, remaining: storedCodes };
    }

    const remaining = [...storedCodes];
    remaining.splice(index, 1);
    return { valid: true, remaining };
  }
}
