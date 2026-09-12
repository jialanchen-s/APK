import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { NeedLogin, Can } from '@server/common/auth/decorators';
import type { Request } from 'express';
import type { CreateEstimateTaskRequest } from '@shared/api.interface';
import { EstimateTaskService } from './estimate-task.service';

@Controller('api/estimate-tasks')
export class EstimateTaskController {
  constructor(private readonly estimateTaskService: EstimateTaskService) {}

  @NeedLogin()
  @Can('create', 'EstimateTask')
  @Post()
  async createTask(
    @Req() req: Request,
    @Body() body: CreateEstimateTaskRequest,
  ) {
    const { userId } = req.userContext;
    return this.estimateTaskService.createTask(userId, body);
  }

  @Get('contract-projects')
  async getContractProjects(@Query('domain') domain?: string) {
    const normalized = domain === 'manufacturing' || domain === 'painting' || domain === 'stamping' ? domain : 'welding';
    return this.estimateTaskService.getContractProjects(normalized);
  }

  @Get(':id')
  async getTask(@Param('id', new ParseUUIDPipe()) id: string) {
    const task = await this.estimateTaskService.getTask(id);
    if (!task) {
      throw new NotFoundException('测算任务不存在');
    }
    return task;
  }

  @Get(':id/items')
  async getTaskItems(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('filter') filter?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.estimateTaskService.getTaskItems(
      id,
      pageNum,
      pageSizeNum,
      filter || 'all',
    );
  }

  @Get(':id/download/:type')
  async downloadResult(
    @Param('id') id: string,
    @Param('type') type: string,
  ) {
    return this.estimateTaskService.downloadResult(id, type);
  }

  @Get(':id/anomaly')
  async getAnomalyResult(@Param('id') id: string) {
    return this.estimateTaskService.getAnomalyResult(id);
  }
}
