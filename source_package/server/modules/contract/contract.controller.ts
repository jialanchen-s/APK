import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin, Can } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import type { ParseContractRequest, ContractReviewActionRequest } from '@shared/api.interface';
import { ContractService } from './contract.service';

@Controller('api/contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @NeedLogin()
  @Can('upload', 'ContractArchive')
  @Post('parse')
  async parseContract(@Req() req: Request, @Body() body: ParseContractRequest) {
    const { userId } = req.userContext;
    return this.contractService.parseContract(userId, body);
  }

  @Get('preview')
  async getPreview(
    @Query('previewId') previewId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.contractService.getPreview(previewId, pageNum, pageSizeNum);
  }

  @NeedLogin()
  @Can('upload', 'ContractArchive')
  @Post('archive')
  async archive(@Req() req: Request, @Body() body: { previewId: string; itemIds: string[] }) {
    const { userId, userName } = req.userContext;
    return this.contractService.archive(userId, userName, body.previewId, body.itemIds);
  }

  @Get('archives/logs')
  async getArchiveLogs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.contractService.getArchiveLogs(limitNum);
  }

  @NeedLogin()
  @Can('delete', 'ContractArchive')
  @Delete('archives')
  async deleteArchives(
    @Req() req: Request,
    @Body() body: { ids: string[] },
  ) {
    const { userId, userName } = req.userContext;
    return this.contractService.deleteContracts(userId, userName, body.ids);
  }

  @Get('archives/batches')
  async getArchiveBatches() {
    return this.contractService.getArchiveBatches();
  }

  @NeedLogin()
  @Can('review', 'ContractArchive')
  @Get('reviews/pending')
  async getPendingReviews() {
    return this.contractService.getPendingReviews();
  }

  @NeedLogin()
  @Can('review', 'ContractArchive')
  @Get('reviews/batch-detail')
  async getBatchDetail(
    @Query('batchId') batchId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.contractService.getBatchDetail(batchId, pageNum, pageSizeNum);
  }

  @NeedLogin()
  @Can('review', 'ContractArchive')
  @Post('reviews/approve')
  async approveBatch(@Req() req: Request, @Body() body: ContractReviewActionRequest) {
    const { userId, userName } = req.userContext;
    return this.contractService.approveBatch(userId, userName, body.batchId, body.remark);
  }

  @NeedLogin()
  @Can('review', 'ContractArchive')
  @Post('reviews/reject')
  async rejectBatch(@Req() req: Request, @Body() body: ContractReviewActionRequest) {
    const { userId, userName } = req.userContext;
    return this.contractService.rejectBatch(userId, userName, body.batchId, body.remark);
  }

  @NeedLogin()
  @Can('delete', 'ContractArchive')
  @Delete('archives/batch')
  async deleteBatch(
    @Req() req: Request,
    @Query('batchId') batchId: string,
  ) {
    const { userId, userName } = req.userContext;
    return this.contractService.deleteBatch(userId, userName, batchId);
  }
}
