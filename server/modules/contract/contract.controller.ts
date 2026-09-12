import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

interface UploadedPdfFile {
  originalname?: string;
  buffer?: Buffer;
}
import { NeedLogin, Can } from '@server/common/auth/decorators';
import type { Request } from 'express';
import type {
  ParseContractRequest,
  ContractReviewActionRequest,
  ArchiveProjectInfoUpdateRequest,
  ExtractPdfContractsRequest,
  PdfUploadInitRequest,
  PdfUploadChunkRequest,
  PdfUploadCompleteRequest,
  LineType,
  ArchiveDomain,
} from '@shared/api.interface';
import { ContractService } from './contract.service';

function normalizeDomain(value: string | undefined): ArchiveDomain {
  if (value === undefined || value === '') return 'welding';
  if (value === 'welding' || value === 'manufacturing' || value === 'painting' || value === 'stamping') return value;
  throw new BadRequestException('domain 参数仅支持 welding、manufacturing、painting、stamping');
}

import { ContractPdfUploadService } from './contract-pdf-upload.service';

@Controller('api/contracts')
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly pdfUploadService: ContractPdfUploadService,
  ) {}

  @NeedLogin()
  @Can('upload', 'ContractArchive')
  @Post('pdf-upload/init')
  async initPdfUpload(@Body() body: PdfUploadInitRequest) {
    return this.pdfUploadService.initPdfUploadSession(body);
  }

  @NeedLogin()
  @Can('upload', 'ContractArchive')
  @Post('pdf-upload/chunk')
  async uploadPdfChunk(@Body() body: PdfUploadChunkRequest) {
    return this.pdfUploadService.appendPdfChunk(body);
  }

  @NeedLogin()
  @Can('upload', 'ContractArchive')
  @Post('pdf-upload/complete')
  async completePdfUpload(@Body() body: PdfUploadCompleteRequest) {
    return this.pdfUploadService.completePdfUpload(body);
  }

  @NeedLogin()
  @Can('upload', 'ContractArchive')
  @Get('pdf-upload/status/:taskId')
  async getPdfUploadStatus(@Param('taskId') taskId: string) {
    return this.pdfUploadService.getExtractionStatus(taskId);
  }

  @NeedLogin()
  @Can('upload', 'ContractArchive')
  @UseInterceptors(FileInterceptor('file'))
  @Post('extract-pdf-upload')
  async extractPdfUpload(
    @UploadedFile() file: UploadedPdfFile,
    @Query('line_type') lineType: string,
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('请求体不是有效的 PDF 文件内容');
    }
    const safeName = (file.originalname || 'contract.pdf').slice(0, 200);
    return this.contractService.extractPdfUpload(
      safeName,
      file.buffer,
      (lineType || '主线') as LineType,
    );
  }

  @NeedLogin()
  @Can('upload', 'ContractArchive')
  @Post('extract-pdf')
  async extractPdf(@Body() body: ExtractPdfContractsRequest) {
    return this.contractService.extractPdfContracts(body);
  }

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
  async archive(@Req() req: Request, @Body() body: {
    previewId: string;
    itemIds: string[];
    projectName?: string;
    settleDate?: string;
    lineType?: string;
    projectTime?: string;
    factoryName?: string;
  }) {
    const { userId, userName } = req.userContext;
    return this.contractService.archive(
      userId,
      userName,
      body.previewId,
      body.itemIds,
      undefined,
      body.projectName,
      body.settleDate,
      body.lineType,
      body.projectTime,
      body.factoryName,
    );
  }

  @Get('archives/logs')
  async getArchiveLogs(@Query('limit') limit?: string, @Query('domain') domain?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.contractService.getArchiveLogs(limitNum, normalizeDomain(domain));
  }

  @NeedLogin()
  @Can('delete', 'ContractArchive')
  @Delete('archives')
  async deleteArchives(
    @Req() req: Request,
    @Body() body: { ids: string[]; domain?: ArchiveDomain },
  ) {
    const { userId, userName } = req.userContext;
    return this.contractService.deleteContracts(userId, userName, body.ids, normalizeDomain(body.domain));
  }

  @Get('archives/batches')
  async getArchiveBatches(@Query('domain') domain?: string) {
    return this.contractService.getArchiveBatches(normalizeDomain(domain));
  }

  @Get('archives/projects')
  async getArchiveProjects(
    @Query('domain') domain?: string,
    @Query('search') search?: string,
  ) {
    return this.contractService.getArchiveProjects(normalizeDomain(domain), search);
  }

  @NeedLogin()
  @Can('edit', 'ContractArchive')
  @Post('archives/projects/update')
  async updateProjectInfo(
    @Req() req: Request,
    @Body() body: ArchiveProjectInfoUpdateRequest,
  ) {
    const { userId } = req.userContext;
    return this.contractService.updateProjectInfo(
      userId,
      normalizeDomain(body.domain),
      body.project,
      body.projectTime,
      body.factoryName,
    );
  }

  @NeedLogin()
  @Can('review', 'ContractArchive')
  @Get('reviews/pending')
  async getPendingReviews(@Query('domain') domain?: string) {
    return this.contractService.getPendingReviews(normalizeDomain(domain));
  }

  @NeedLogin()
  @Can('review', 'ContractArchive')
  @Get('reviews/batch-detail')
  async getBatchDetail(
    @Query('batchId') batchId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('domain') domain?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.contractService.getBatchDetail(batchId, pageNum, pageSizeNum, normalizeDomain(domain));
  }

  @NeedLogin()
  @Can('review', 'ContractArchive')
  @Post('reviews/approve')
  async approveBatch(@Req() req: Request, @Body() body: ContractReviewActionRequest) {
    const { userId, userName } = req.userContext;
    return this.contractService.approveBatch(userId, userName, body.batchId, body.remark, normalizeDomain(body.domain));
  }

  @NeedLogin()
  @Can('review', 'ContractArchive')
  @Post('reviews/reject')
  async rejectBatch(@Req() req: Request, @Body() body: ContractReviewActionRequest) {
    const { userId, userName } = req.userContext;
    return this.contractService.rejectBatch(userId, userName, body.batchId, body.remark, normalizeDomain(body.domain));
  }

  @NeedLogin()
  @Can('delete', 'ContractArchive')
  @Delete('archives/batch')
  async deleteBatch(
    @Req() req: Request,
    @Query('batchId') batchId: string,
    @Query('domain') domain?: string,
  ) {
    const { userId, userName } = req.userContext;
    return this.contractService.deleteBatch(userId, userName, batchId, normalizeDomain(domain));
  }

  @NeedLogin()
  @Can('delete', 'ContractArchive')
  @Post('archives/clear-rejected')
  async clearRejectedBatches(
    @Req() req: Request,
    @Body() body: { domain?: string },
  ) {
    const { userId, userName } = req.userContext;
    return this.contractService.clearRejectedBatches(userId, userName, normalizeDomain(body.domain));
  }
}
