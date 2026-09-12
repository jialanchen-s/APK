import { Module } from '@nestjs/common';
import { PendingItemController } from './pending-item.controller';
import { PendingItemService } from './pending-item.service';
import { ModelModule } from '../model/model.module';
import { EstimateTaskModule } from '../estimate-task/estimate-task.module';

@Module({
  imports: [ModelModule, EstimateTaskModule],
  controllers: [PendingItemController],
  providers: [PendingItemService],
})
export class PendingItemModule {}
