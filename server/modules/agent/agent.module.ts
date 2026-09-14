import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { EstimateTaskModule } from '../estimate-task/estimate-task.module';
import { ModelModule } from '../model/model.module';
import { AIModule } from '@server/common/ai/ai.module';

@Module({
  imports: [AIModule, EstimateTaskModule, ModelModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
