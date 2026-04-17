import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { randomBytes, timingSafeEqual } from 'crypto';
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
      codes.push(randomBytes(16).toString('hex'));
    }
    return codes;
  }

  private timingSafeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a.toLowerCase());
    const bufB = Buffer.from(b.toLowerCase());
    if (bufA.length !== bufB.length) {
      // Compare against self to burn constant time, then return false
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  verifyRecoveryCode(
    storedCodes: string[],
    code: string,
  ): { valid: boolean; remaining: string[] } {
    const normalizedCode = code.toLowerCase().trim();
    // Scan all codes in constant time to prevent timing leaks
    let matchIndex = -1;
    for (let i = 0; i < storedCodes.length; i++) {
      if (this.timingSafeCompare(storedCodes[i].trim(), normalizedCode)) {
        matchIndex = i;
      }
    }

    if (matchIndex === -1) {
      return { valid: false, remaining: storedCodes };
    }

    const remaining = [...storedCodes];
    remaining.splice(matchIndex, 1);
    return { valid: true, remaining };
  }
}
