import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { KmsService } from './kms.service';
import { SignedUrlService } from './signed-url.service';
import { SecretRotationService } from './secret-rotation.service';

@Global()
@Module({
  providers: [KmsService, CryptoService, SignedUrlService, SecretRotationService],
  exports: [CryptoService, KmsService, SignedUrlService, SecretRotationService],
})
export class CryptoModule {}
