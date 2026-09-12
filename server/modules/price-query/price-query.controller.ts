import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import type { PriceQueryParams, ArchivePeriod, ArchiveDomain } from '@shared/api.interface';
import { PriceQueryService } from './price-query.service';

@Controller('api/price-query')
export class PriceQueryController {
  constructor(private readonly priceQueryService: PriceQueryService) {}

  @Get('search')
  async search(
    @Query('device_material_name') deviceMaterialName?: string,
    @Query('project') project?: string,
    @Query('line_type') lineType?: string,
    @Query('usage_scope') usageScope?: string,
    @Query('category') category?: string,
    @Query('supply') supply?: string,
    @Query('settle_date_from') settleDateFrom?: string,
    @Query('settle_date_to') settleDateTo?: string,
    @Query('archive_period') archivePeriod?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('domain') domain?: string,
  ) {
    const params: PriceQueryParams = {
      device_material_name: deviceMaterialName,
      project: project,
      line_type: lineType as any,
      usage_scope: usageScope as any,
      category: category as any,
      supply: supply as any,
      settle_date_from: settleDateFrom,
      settle_date_to: settleDateTo,
      archive_period: archivePeriod as ArchivePeriod | undefined,
      domain: domain as ArchiveDomain | undefined,
    };
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.priceQueryService.search(params, pageNum, pageSizeNum);
  }

  @Get('stats')
  async getStats(
    @Query('device_material_name') deviceMaterialName?: string,
    @Query('project') project?: string,
    @Query('line_type') lineType?: string,
    @Query('usage_scope') usageScope?: string,
    @Query('category') category?: string,
    @Query('supply') supply?: string,
    @Query('settle_date_from') settleDateFrom?: string,
    @Query('settle_date_to') settleDateTo?: string,
    @Query('archive_period') archivePeriod?: string,
    @Query('domain') domain?: string,
  ) {
    const params: PriceQueryParams = {
      device_material_name: deviceMaterialName,
      project: project,
      line_type: lineType as any,
      usage_scope: usageScope as any,
      category: category as any,
      supply: supply as any,
      settle_date_from: settleDateFrom,
      settle_date_to: settleDateTo,
      archive_period: archivePeriod as ArchivePeriod | undefined,
      domain: domain as ArchiveDomain | undefined,
    };
    return this.priceQueryService.getStats(params);
  }

  @Get('archive-counts')
  async getArchiveCounts(@Query('domain') domain?: string) {
    return this.priceQueryService.getArchiveCounts(domain as ArchiveDomain | undefined);
  }
}
