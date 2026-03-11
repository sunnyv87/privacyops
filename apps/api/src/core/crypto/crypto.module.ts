import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { KmsService } from './kms.service';
import { SignedUrlService } from './signed-url.service';

@Global()
@Module({
  providers: [KmsService, CryptoService, SignedUrlService],
  exports: [CryptoService, KmsService, SignedUrlService],
})
export class CryptoModule {}
