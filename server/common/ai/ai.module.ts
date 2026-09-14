import { Module } from '@nestjs/common';
import { AIGatewayService } from './ai-gateway.service';
import { AIBootstrapService } from './ai-bootstrap.service';
import { ImageRecognitionService } from './image-recognition.service';
import { StructuredExtractionService } from './structured-extraction.service';

@Module({
  providers: [AIGatewayService, AIBootstrapService, ImageRecognitionService, StructuredExtractionService],
  exports: [AIGatewayService, ImageRecognitionService, StructuredExtractionService],
})
export class AIModule {}
