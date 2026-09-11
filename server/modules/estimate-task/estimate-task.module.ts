import { Module } from '@nestjs/common';
import { EstimateTaskController } from './estimate-task.controller';
import { EstimateTaskService } from './estimate-task.service';
import { ModelModule } from '../model/model.module';
import { AIModule } from '@server/common/ai/ai.module';

@Module({
  imports: [ModelModule, AIModule],
  controllers: [EstimateTaskController],
  providers: [EstimateTaskService],
  exports: [EstimateTaskService],
})
export class EstimateTaskModule {}
