import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { NeedLogin, Can } from '@server/common/auth/decorators';
import { PendingItemService } from './pending-item.service';

@Controller('api/pending-items')
export class PendingItemController {
  constructor(private readonly pendingItemService: PendingItemService) {}

  @Get('latest-task')
  async getLatestTask() {
    return this.pendingItemService.getLatestTask();
  }

  @Get('groups')
  async getGroups(@Query('taskId') taskId: string) {
    return this.pendingItemService.getGroups(taskId);
  }

  @Get()
  async getItems(
    @Query('taskId') taskId: string,
    @Query('groupType') groupType: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.pendingItemService.getItems(taskId, groupType, pageNum, pageSizeNum);
  }

  @NeedLogin()
  @Can('update', 'PendingItem')
  @Post('reset')
  async resetTask(@Body() body: { taskId: string }) {
    return this.pendingItemService.cancelTaskPendingItems(body.taskId);
  }

  @NeedLogin()
  @Can('update', 'PendingItem')
  @Post('batch-apply')
  async batchApply(@Body() body: { taskId: string; itemIds: string[]; params: Record<string, string | number> }) {
    return this.pendingItemService.batchApply(body.taskId, body.itemIds, body.params);
  }

  @NeedLogin()
  @Can('update', 'PendingItem')
  @Post('submit')
  async submit(@Body() body: { taskId: string; items: { id: string; params: Record<string, string | number>; manual_price?: number }[] }) {
    return this.pendingItemService.submit(body.taskId, body.items);
  }

  @NeedLogin()
  @Can('update', 'PendingItem')
  @Post('apply-model')
  async applyModel(@Body() body: { taskId: string; itemIds: string[]; modelId: string; paramValues?: Record<string, string | number> }) {
    return this.pendingItemService.applyModel(body.taskId, body.itemIds, body.modelId, body.paramValues);
  }
}
