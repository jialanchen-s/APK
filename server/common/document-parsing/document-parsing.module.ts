import { Global, Module } from '@nestjs/common';
import { DocumentParsingService } from './document-parsing.service';

@Global()
@Module({
  providers: [DocumentParsingService],
  exports: [DocumentParsingService],
})
export class DocumentParsingModule {}
