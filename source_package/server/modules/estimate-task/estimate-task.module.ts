import { Module } from '@nestjs/common';
import { EstimateTaskController } from './estimate-task.controller';
import { EstimateTaskService } from './estimate-task.service';
import { ModelModule } from '../model/model.module';

@Module({
  imports: [ModelModule],
  controllers: [EstimateTaskController],
  providers: [EstimateTaskService],
  exports: [EstimateTaskService],
})
export class EstimateTaskModule {}
