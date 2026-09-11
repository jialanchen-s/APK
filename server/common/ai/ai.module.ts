import { Module } from '@nestjs/common';
import { AIGatewayService } from './ai-gateway.service';
import { AIBootstrapService } from './ai-bootstrap.service';

@Module({
  providers: [AIGatewayService, AIBootstrapService],
  exports: [AIGatewayService],
})
export class AIModule {}
