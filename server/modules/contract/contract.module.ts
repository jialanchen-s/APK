import { Module } from '@nestjs/common';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractPdfUploadService } from './contract-pdf-upload.service';
import { ContractClearAutomationService } from './contract.automation';
import { AIModule } from '@server/common/ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [ContractController],
  providers: [ContractService, ContractPdfUploadService, ContractClearAutomationService],
})
export class ContractModule {}
