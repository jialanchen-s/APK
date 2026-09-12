import { Module, Global } from '@nestjs/common';
import { LocalCapabilityService } from './local-capability.service';

@Global()
@Module({
  providers: [LocalCapabilityService],
  exports: [LocalCapabilityService],
})
export class CapabilityModule {}
