import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { NeedLogin, Can } from '@server/common/auth/decorators';
import { PendingItemService } from './pending-item.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireTaskId(value: string | undefined): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new BadRequestException('taskId 必须为合法的 UUID');
  }
  return value;
}

function requireItemIds(value: string[] | undefined): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('itemIds 不能为空');
  }
  if (value.some((id) => !UUID_PATTERN.test(id))) {
    throw new BadRequestException('itemIds 必须为合法的 UUID 列表');
  }
  return value;
}

@Controller('api/pending-items')
export class PendingItemController {
  constructor(private readonly pendingItemService: PendingItemService) {}

  @Get('latest-task')
  async getLatestTask() {
    return this.pendingItemService.getLatestTask();
  }

  @Get('groups')
  async getGroups(@Query('taskId', new ParseUUIDPipe()) taskId: string) {
    return this.pendingItemService.getGroups(taskId);
  }

  @Get()
  async getItems(
    @Query('taskId', new ParseUUIDPipe()) taskId: string,
    @Query('groupType') groupType: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!groupType) {
      throw new BadRequestException('groupType 不能为空');
    }
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.pendingItemService.getItems(taskId, groupType, pageNum, pageSizeNum);
  }

  @NeedLogin()
  @Can('update', 'PendingItem')
  @Post('reset')
  async resetTask(@Body() body: { taskId: string }) {
    return this.pendingItemService.cancelTaskPendingItems(requireTaskId(body.taskId));
  }

  @NeedLogin()
  @Can('update', 'PendingItem')
  @Post('batch-apply')
  async batchApply(@Body() body: { taskId: string; itemIds: string[]; params: Record<string, string | number> }) {
    return this.pendingItemService.batchApply(
      requireTaskId(body.taskId),
      requireItemIds(body.itemIds),
      body.params ?? {},
    );
  }

  @NeedLogin()
  @Can('update', 'PendingItem')
  @Post('submit')
  async submit(@Body() body: { taskId: string; items: { id: string; params: Record<string, string | number>; manual_price?: number }[] }) {
    requireItemIds(body.items?.map((i) => i?.id));
    return this.pendingItemService.submit(requireTaskId(body.taskId), body.items);
  }

  @NeedLogin()
  @Can('update', 'PendingItem')
  @Post('apply-model')
  async applyModel(@Body() body: { taskId: string; itemIds: string[]; modelId: string; paramValues?: Record<string, string | number> }) {
    if (!body.modelId) {
      throw new BadRequestException('modelId 不能为空');
    }
    return this.pendingItemService.applyModel(
      requireTaskId(body.taskId),
      requireItemIds(body.itemIds),
      body.modelId,
      body.paramValues,
    );
  }
}
