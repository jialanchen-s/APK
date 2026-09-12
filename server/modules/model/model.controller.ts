import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NeedLogin, Can } from '@server/common/auth/decorators';
import type { Request } from 'express';
import { ModelService } from './model.service';

@Controller('api/models')
export class ModelController {
  constructor(private readonly modelService: ModelService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.modelService.list(pageNum, pageSizeNum);
  }

  @NeedLogin()
  @Can('update', 'Model')
  @Post()
  async save(@Req() req: Request, @Body() body: {
    id?: string;
    model_name: string;
    applicable_type: string;
    input_vars: any[];
    formula_logic: string;
    constants: Record<string, string | number>;
  }) {
    const { userId } = req.userContext;
    return this.modelService.save(userId, body);
  }

  @NeedLogin()
  @Can('tryout', 'Model')
  @Post(':id/tryout')
  async tryout(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: { params: Record<string, string | number> }) {
    return this.modelService.tryout(id, body.params);
  }

  @NeedLogin()
  @Can('tryout', 'Model')
  @Post('tryout-by-model-id')
  async tryoutByModelId(@Body() body: { model_id: string; params: Record<string, string | number> }) {
    return this.modelService.tryoutByModelId(body.model_id, body.params);
  }

  @NeedLogin()
  @Can('publish', 'Model')
  @Post(':id/publish')
  async publish(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    const { userId } = req.userContext;
    return this.modelService.publish(userId, id);
  }

  @NeedLogin()
  @Can('update', 'Model')
  @Delete(':id')
  async delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.modelService.delete(id);
  }

  @Get(':id/versions')
  async getVersions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.modelService.getVersions(id, pageNum, pageSizeNum);
  }
}
