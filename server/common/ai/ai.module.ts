import { Module } from '@nestjs/common';
import { AIGatewayService } from './ai-gateway.service';
import { AIBootstrapService } from './ai-bootstrap.service';
import { ImageRecognitionService } from './image-recognition.service';

@Module({
  providers: [AIGatewayService, AIBootstrapService, ImageRecognitionService],
  exports: [AIGatewayService, ImageRecognitionService],
})
export class AIModule {}
