import { Module } from '@nestjs/common';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractPdfUploadService } from './contract-pdf-upload.service';
import { ContractClearAutomationService } from './contract.automation';

@Module({
  controllers: [ContractController],
  providers: [ContractService, ContractPdfUploadService, ContractClearAutomationService],
})
export class ContractModule {}
