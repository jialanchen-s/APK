import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { LocalCapabilityService } from '@server/common/capability/local-capability.service';
import { FileStorageService } from '@server/common/file/file-storage.service';
import { contract, manufacturingContract, paintingContract, stampingContract, archiveLog, previewStore } from '@server/database/schema';
import { eq, inArray, lt, sql, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { FileParseTextOneOutput } from '@shared/plugin-types';
import {
  callCapabilityWithTimeout,
  serializePluginError,
} from '@server/common/utils/plugin-call';

import type {
  ExtractPdfContractsRequest,
  ExtractPdfContractsResponse,
  ParseContractRequest,
  ContractParseResponse,
  ContractPreviewResponse,
  ManufacturingContractPreviewResponse,
  ContractPreviewResponseUnion,
  ContractRow,
  ManufacturingContractRow,
  ContractRowUnion,
  ContractPreviewStatus,
  ContractPreviewItem,
  ManufacturingContractPreviewItem,
  ContractArchiveResponse,
  ArchiveProjectSummary,
  ArchiveProjectInfoUpdateResponse,
  ContractArchiveLogsResponse,
  ContractArchiveLog,
  LineType,
  ArchiveDomain,
  UsageScope,
  ModifyLevel,
  CopyMode,
  PriceCaliber,
  SupplyType,
  ContractReviewStatus,
  ContractReviewListResponse,
  ContractReviewBatch,
  ContractReviewActionResponse,
  ContractClearRejectedResponse,
  ContractReviewDetailItem,
  ContractReviewDetailResponse,
} from '@shared/api.interface';
import { ARCHIVE_DOMAIN_LABELS, ARCHIVE_DOMAIN_VALUES } from '@shared/api.interface';

type StoredPreviewItem = ContractPreviewItem | ManufacturingContractPreviewItem;

interface StoredPreview {
  domain: ArchiveDomain;
  items: StoredPreviewItem[];
  createdAt: number;
}

interface ArchiveLogEntry {
  operator: string;
  operate_time: string;
  count: number;
  batch_id?: string;
  batch_name?: string;
  domain?: ArchiveDomain;
}

function formatDateInChina(value: Date | string | number | null | undefined): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
}

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  private static resolveDomain(domain: ArchiveDomain | undefined): ArchiveDomain {
    return ARCHIVE_DOMAIN_VALUES.includes(domain as ArchiveDomain) ? (domain as ArchiveDomain) : 'welding';
  }

  private static tableFor(domain: ArchiveDomain) {
    switch (domain) {
      case 'manufacturing':
        return manufacturingContract;
      case 'painting':
        return paintingContract;
      case 'stamping':
        return stampingContract;
      default:
        return contract;
    }
  }

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: any,
    @Inject() private readonly capabilityService: LocalCapabilityService,
    private readonly fileService: FileStorageService,
  ) {}

  private async loadPreview(previewId: string): Promise<StoredPreview | null> {
    const rows = await this.db
      .select()
      .from(previewStore)
      .where(eq(previewStore.previewId, previewId))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return { domain: r.domain as ArchiveDomain, items: r.items as StoredPreviewItem[], createdAt: r.createdAt };
  }

  async parseContract(
    userId: string,
    data: ParseContractRequest,
  ): Promise<ContractParseResponse> {
    this.logger.log(
      `parseContract: userId=${userId}, fileName=${data.file_name}, rows=${data.rows.length}, domain=${data.domain}`,
    );

    const domain = ContractService.resolveDomain(data.domain);
    const isManufacturing = domain !== 'welding';

    const previewId = `preview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const items: StoredPreviewItem[] = data.rows.map(
      (row: ContractRowUnion, index: number) => {
        let status: ContractPreviewStatus = 'valid';
        let invalidReason: string | undefined;

        if (row.unit_price < 0 || row.unit_price > 10000000) {
          status = 'invalid';
          invalidReason = '价格异常';
        }

        const base = {
          id: `item_${index}`,
          source_file: data.file_name,
          project: row.project,
          device_material_name: row.device_material_name,
          unit_price: row.unit_price,
          price_caliber: row.price_caliber,
          unit: row.unit,
          settle_date: row.settle_date,
          status,
          invalidReason,
          quantity: row.quantity,
          selected_brand: row.selected_brand,
          subtotal: row.subtotal,
          remark: row.remark,
        };

        if (isManufacturing) {
          const m = row as ManufacturingContractRow;
          return {
            ...base,
            specification: m.specification,
          } satisfies ManufacturingContractPreviewItem as StoredPreviewItem;
        }
        const w = row as ContractRow;
        return {
          ...base,
          line_type: w.line_type,
          usage_scope: w.usage_scope,
          category: w.category,
          distinction: w.distinction,
          copy_mode: w.copy_mode,
          supply: w.supply,
          workstation_no: w.workstation_no,
          workstation_desc: w.workstation_desc,
        } satisfies ContractPreviewItem as StoredPreviewItem;
      },
    );

    await this.db
      .insert(previewStore)
      .values({ previewId, domain, items: sql`${JSON.stringify(items)}::jsonb`, createdAt: Date.now() })
      .onConflictDoUpdate({
        target: previewStore.previewId,
        set: { items: sql`${JSON.stringify(items)}::jsonb`, createdAt: Date.now(), domain },
      });
    this.purgeExpiredPreviews().catch(() => {});

    const validCount = items.filter((i) => i.status === 'valid').length;

    return {
      previewId,
      totalCount: items.length,
      validCount,
      invalidCount: items.length - validCount,
    };
  }

  async getPreview(
    previewId: string,
    page: number,
    pageSize: number,
  ): Promise<ContractPreviewResponseUnion> {
    this.logger.log(
      `getPreview: previewId=${previewId}, page=${page}, pageSize=${pageSize}`,
    );
    const stored = await this.loadPreview(previewId);
    const items = stored?.items ?? [];
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    if (stored?.domain && stored.domain !== 'welding') {
      return {
        items: paged as ManufacturingContractPreviewItem[],
        total: items.length,
      };
    }
    return { items: paged as ContractPreviewItem[], total: items.length };
  }

  async archive(
    userId: string,
    userName: string,
    previewId: string,
    itemIds: string[],
    batchName?: string,
    projectName?: string,
    settleDate?: string,
    lineType?: string,
    projectTime?: string,
    factoryName?: string,
  ): Promise<ContractArchiveResponse> {
    this.logger.log(
      `archive: userId=${userId}, previewId=${previewId}, itemIds=${itemIds.length}, ` +
        `projectName=${projectName ?? '-'}, settleDate=${settleDate ?? '-'}, lineType=${lineType ?? '-'}, ` +
        `projectTime=${projectTime ?? '-'}, factoryName=${factoryName ?? '-'}`,
    );
    const stored = await this.loadPreview(previewId);
    const domain = stored?.domain ?? 'welding';
    let items = stored?.items ?? [];
    const toArchive = items.filter(
      (i) => itemIds.includes(i.id) && i.status === 'valid',
    );

    if (toArchive.length === 0) {
      return { success: true, archivedCount: 0 };
    }

    let settleDateValue = new Date();
    if (settleDate && /^\d{4}-\d{2}-\d{2}$/.test(settleDate)) {
      const parsed = new Date(`${settleDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        settleDateValue = parsed;
      }
    }

    if (projectName !== undefined && projectName !== '') {
      toArchive.forEach((i) => {
        i.project = projectName;
      });
    }
    if (lineType !== undefined && lineType !== '') {
      toArchive.forEach((i) => {
        if ('line_type' in i) {
          (i as ContractPreviewItem).line_type = lineType as ContractPreviewItem['line_type'];
        }
      });
    }

    const batchId = randomUUID();
    const now = new Date();
    const defaultBatchName = this.generateBatchName(toArchive, domain);
    const finalBatchName = batchName || defaultBatchName;

    const table = ContractService.tableFor(domain);
    const isManufacturing = domain !== 'welding';

    const baseValues = toArchive.map((item) => ({
      project: item.project,
      deviceMaterialName: item.device_material_name,
      unitPrice: String(item.unit_price),
      priceCaliber: item.price_caliber,
      unit: item.unit,
      settleDate: settleDateValue,
      archiveTime: now,
      archiveBatchId: batchId,
      archiveBatchName: finalBatchName,
      quantity: item.quantity != null ? String(item.quantity) : undefined,
      selectedBrand: item.selected_brand,
      subtotal: item.subtotal != null ? String(item.subtotal) : undefined,
      remark: item.remark,
      archiveOperator: userId,
      projectTime: projectTime?.trim() || undefined,
      factoryName: factoryName?.trim() || undefined,
      status: 'pending_review',
      createdBy: userId,
      updatedBy: userId,
    }));

    if (isManufacturing) {
      await this.db.insert(table).values(
        toArchive.map((item, index: number) => ({
          ...baseValues[index],
          specification: (item as ManufacturingContractPreviewItem).specification,
        })),
      );
    } else {
      await this.db.insert(table).values(
        toArchive.map((item, index: number) => {
          const w = item as ContractPreviewItem;
          return {
            ...baseValues[index],
            lineType: w.line_type,
            usageScope: w.usage_scope,
            category: w.category,
            distinction: w.distinction,
            copyMode: w.copy_mode,
            supply: w.supply,
            workstationNo: w.workstation_no,
            workstationDesc: w.workstation_desc,
          };
        }),
      );
    }

    this.appendArchiveLog({
      operator: userName || userId,
      operate_time: now.toISOString(),
      count: toArchive.length,
      batch_id: batchId,
      batch_name: finalBatchName,
      domain,
    }).catch(() => {});

    await this.db.delete(previewStore).where(eq(previewStore.previewId, previewId));

    return { success: true, archivedCount: toArchive.length, batchId: String(batchId), batchName: finalBatchName };
  }

  async getPendingReviews(domain?: ArchiveDomain): Promise<ContractReviewListResponse> {
    const d = ContractService.resolveDomain(domain);
    const table = ContractService.tableFor(d);
    this.logger.log(`getPendingReviews: domain=${d}`);
    const result = await this.db
      .select({
        batchId: table.archiveBatchId,
        batchName: table.archiveBatchName,
        count: sql<number>`count(*)::int`,
        submitter: table.archiveOperator,
        submitTime: sql<string>`max(${table.archiveTime})::text`,
        lineType: sql<string>`max(${table.lineType})`,
      })
      .from(table)
      .where(sql`${table.status} = 'pending_review' AND ${table.archiveBatchId} IS NOT NULL`)
      .groupBy(table.archiveBatchId, table.archiveBatchName, table.archiveOperator)
      .orderBy(sql`max(${table.archiveTime}) DESC`);

    const batches: ContractReviewBatch[] = result.map((r) => ({
      batchId: String(r.batchId),
      batchName: r.batchName || '未命名批次',
      count: r.count,
      submitter: r.submitter || '',
      submitTime: r.submitTime || '',
      status: 'pending_review' as const,
      lineType: r.lineType || undefined,
      domain: d,
    }));
    return { batches };
  }

  async getBatchDetail(
    batchId: string,
    page: number,
    pageSize: number,
    domain?: ArchiveDomain,
  ): Promise<ContractReviewDetailResponse> {
    const d = ContractService.resolveDomain(domain);
    const table = ContractService.tableFor(d);
    this.logger.log(`getBatchDetail: batchId=${batchId}, page=${page}, pageSize=${pageSize}, domain=${d}`);
    const offset = (page - 1) * pageSize;
    const baseCols = {
      id: table.id,
      project: table.project,
      lineType: table.lineType,
      deviceMaterialName: table.deviceMaterialName,
      usageScope: table.usageScope,
      category: table.category,
      distinction: table.distinction,
      copyMode: table.copyMode,
      unitPrice: table.unitPrice,
      priceCaliber: table.priceCaliber,
      supply: table.supply,
      unit: table.unit,
      settleDate: table.settleDate,
      quantity: table.quantity,
      selectedBrand: table.selectedBrand,
      subtotal: table.subtotal,
      remark: table.remark,
      workstationNo: table.workstationNo,
      workstationDesc: table.workstationDesc,
      status: table.status,
    };
    const cols = d !== 'welding'
      ? { ...baseCols, specification: (table as typeof manufacturingContract).specification }
      : baseCols;
    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(table)
        .where(sql`${table.archiveBatchId} = ${batchId}::uuid`),
      this.db
        .select(cols)
        .from(table)
        .where(sql`${table.archiveBatchId} = ${batchId}::uuid`)
        .orderBy(table.archiveTime)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const items: ContractReviewDetailItem[] = rows.map((r) => ({
      id: String(r.id),
      project: r.project || '',
      line_type: (r.lineType || '主线') as LineType,
      device_material_name: r.deviceMaterialName || '',
      usage_scope: (r.usageScope || undefined) as UsageScope | undefined,
      category: r.category || undefined,
      distinction: (r.distinction || undefined) as ModifyLevel | undefined,
      copy_mode: (r.copyMode || undefined) as CopyMode | undefined,
      unit_price: parseFloat(String(r.unitPrice)) || 0,
      price_caliber: (r.priceCaliber || '未税') as PriceCaliber,
      supply: (r.supply || undefined) as SupplyType | undefined,
      unit: r.unit || undefined,
      settle_date: formatDateInChina(r.settleDate),
      quantity: r.quantity != null ? parseFloat(String(r.quantity)) : undefined,
      selected_brand: r.selectedBrand || undefined,
      subtotal: r.subtotal != null ? parseFloat(String(r.subtotal)) : undefined,
      remark: r.remark || undefined,
      workstation_no: r.workstationNo || undefined,
      workstation_desc: r.workstationDesc || undefined,
      specification: 'specification' in r ? (r.specification as string | undefined) : undefined,
      status: (r.status || 'pending_review') as ContractReviewStatus,
    }));
    return { items, total };
  }

  async approveBatch(
    userId: string,
    userName: string,
    batchId: string,
    remark?: string,
    domain?: ArchiveDomain,
  ): Promise<ContractReviewActionResponse> {
    this.logger.log(`approveBatch: userId=${userId}, batchId=${batchId}, domain=${domain}`);
    const table = ContractService.tableFor(ContractService.resolveDomain(domain));
    const now = new Date();
    const result = await this.db
      .update(table)
      .set({
        status: 'approved',
        reviewer: userId,
        reviewTime: now,
        reviewRemark: remark,
        updatedBy: userId,
      })
      .where(sql`${table.archiveBatchId} = ${batchId}::uuid AND ${table.status} = 'pending_review'`)
      .returning({ id: table.id });

    this.logger.log(`approveBatch: approved ${result.length} items by ${userName || userId}`);
    return { success: true, affectedCount: result.length };
  }

  async rejectBatch(
    userId: string,
    userName: string,
    batchId: string,
    remark?: string,
    domain?: ArchiveDomain,
  ): Promise<ContractReviewActionResponse> {
    this.logger.log(`rejectBatch: userId=${userId}, batchId=${batchId}, domain=${domain}`);
    const table = ContractService.tableFor(ContractService.resolveDomain(domain));
    const now = new Date();
    const result = await this.db
      .update(table)
      .set({
        status: 'rejected',
        reviewer: userId,
        reviewTime: now,
        reviewRemark: remark,
        updatedBy: userId,
      })
      .where(sql`${table.archiveBatchId} = ${batchId}::uuid AND ${table.status} = 'pending_review'`)
      .returning({ id: table.id });

    this.logger.log(`rejectBatch: rejected ${result.length} items by ${userName || userId}`);
    return { success: true, affectedCount: result.length };
  }

  private generateBatchName(items: StoredPreviewItem[], domain: ArchiveDomain): string {
    if (items.length === 0) return '未命名批次';
    const firstItem = items[0];
    const dateStr = formatDateInChina(new Date()).replace(/-/g, '');
    const hasLineType = 'line_type' in firstItem;
    const lineType = hasLineType ? firstItem.line_type || '未知线别' : ARCHIVE_DOMAIN_LABELS[domain];
    const projectSet = new Set(items.map((i) => i.project).filter(Boolean));
    const projectLabel =
      projectSet.size === 0
        ? '未指定项目'
        : projectSet.size === 1
          ? [...projectSet][0]
          : `${projectSet.size}个项目`;
    return `${dateStr}_${projectLabel}_${lineType}_${items.length}条`;
  }

  async getArchiveLogs(limit: number, domain?: ArchiveDomain): Promise<ContractArchiveLogsResponse> {
    this.logger.log(`getArchiveLogs: limit=${limit}, domain=${domain ?? 'welding'}`);
    const d = ContractService.resolveDomain(domain);
    const rows = await this.db
      .select()
      .from(archiveLog)
      .where(eq(archiveLog.domain, d))
      .orderBy(desc(archiveLog.id))
      .limit(limit);
    const logs: ContractArchiveLog[] = rows.map((r: any) => ({
      operator: r.operator,
      operate_time: r.operateTime,
      count: r.count,
      batch_id: r.batchId ?? undefined,
      batch_name: r.batchName ?? undefined,
      domain: r.domain ?? undefined,
    }));
    return { logs };
  }

  async deleteContracts(
    userId: string,
    userName: string,
    ids: string[],
    domain?: ArchiveDomain,
  ): Promise<{ success: boolean; deletedCount: number }> {
    this.logger.log(
      `deleteContracts: userId=${userId}, userName=${userName}, ids=${ids.length}, domain=${domain}`,
    );

    if (ids.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const table = ContractService.tableFor(ContractService.resolveDomain(domain));
    const result = await this.db
      .delete(table)
      .where(inArray(table.id, ids))
      .returning({ id: table.id });

    this.appendArchiveLog({
      operator: userName || userId,
      operate_time: new Date().toISOString(),
      count: -result.length,
    }).catch(() => {});

    return { success: true, deletedCount: result.length };
  }

  async getArchiveBatches(domain?: ArchiveDomain): Promise<{
    batchId: string;
    batchName: string;
    count: number;
    archiveTime: string;
    status: string;
    reviewRemark: string | null;
    reviewTime: string | null;
  }[]> {
    const table = ContractService.tableFor(ContractService.resolveDomain(domain));
    this.logger.log(`getArchiveBatches: domain=${domain ?? 'welding'}`);
    const result = await this.db
      .select({
        batchId: table.archiveBatchId,
        batchName: table.archiveBatchName,
        count: sql<number>`count(*)::int`,
        archiveTime: sql<string>`max(${table.archiveTime})::text`,
        status: sql<string>`max(${table.status})`,
        reviewRemark: sql<string | null>`max(${table.reviewRemark})`,
        reviewTime: sql<string | null>`max(${table.reviewTime})::text`,
      })
      .from(table)
      .where(sql`${table.archiveBatchId} IS NOT NULL`)
      .groupBy(table.archiveBatchId, table.archiveBatchName)
      .orderBy(sql`max(${table.archiveTime}) DESC`);

    return result.map((r) => ({
      batchId: String(r.batchId),
      batchName: r.batchName || '未命名批次',
      count: r.count,
      archiveTime: r.archiveTime || '',
      status: r.status || 'pending_review',
      reviewRemark: r.reviewRemark,
      reviewTime: r.reviewTime,
    }));
  }

  async getArchiveProjects(domain?: ArchiveDomain, search?: string): Promise<ArchiveProjectSummary[]> {
    const table = ContractService.tableFor(ContractService.resolveDomain(domain));
    this.logger.log(`getArchiveProjects: domain=${domain ?? 'welding'}, search=${search ?? ''}`);
    const conditions = [sql`${table.project} IS NOT NULL AND ${table.project} <> ''`];
    if (search && search.trim()) {
      const searchLower = `%${search.trim().toLowerCase()}%`;
      conditions.push(sql`LOWER(${table.project}) LIKE ${searchLower}`);
    }
    const where = sql.join(conditions, sql` AND `);
    const result = await this.db
      .select({
        project: table.project,
        count: sql<number>`count(*)::int`,
        latestArchiveTime: sql<string>`max(${table.archiveTime})::text`,
        earliestArchiveTime: sql<string>`min(${table.archiveTime})::text`,
        projectTime: sql<string | null>`max(nullif(${table.projectTime}, ''))`,
        factoryName: sql<string | null>`max(nullif(${table.factoryName}, ''))`,
      })
      .from(table)
      .where(where)
      .groupBy(table.project)
      .orderBy(sql`max(${table.archiveTime}) DESC`);

    return result.map((r) => ({
      project: r.project || '',
      count: r.count,
      latestArchiveTime: r.latestArchiveTime || '',
      earliestArchiveTime: r.earliestArchiveTime || '',
      projectTime: r.projectTime || undefined,
      factoryName: r.factoryName || undefined,
    }));
  }

  async updateProjectInfo(
    userId: string,
    domain: ArchiveDomain | undefined,
    project: string,
    projectTime?: string,
    factoryName?: string,
  ): Promise<ArchiveProjectInfoUpdateResponse> {
    const trimmedProject = project?.trim();
    if (!trimmedProject) {
      throw new BadRequestException('项目名称不能为空');
    }
    const table = ContractService.tableFor(ContractService.resolveDomain(domain));
    this.logger.log(
      `updateProjectInfo: userId=${userId}, project=${trimmedProject}, domain=${domain ?? 'welding'}, ` +
        `projectTime=${JSON.stringify(projectTime ?? null)}, factoryName=${JSON.stringify(factoryName ?? null)}`,
    );

    const patch: Partial<typeof table.$inferInsert> = {};
    if (projectTime !== undefined) patch.projectTime = projectTime.trim() || null;
    if (factoryName !== undefined) patch.factoryName = factoryName.trim() || null;
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }
    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const updated = await this.db
      .update(table)
      .set(patch)
      .where(eq(table.project, trimmedProject))
      .returning({ id: table.id });
    if (updated.length === 0) {
      throw new NotFoundException(`项目「${trimmedProject}」下没有归档数据`);
    }
    return { success: true, updatedCount: updated.length };
  }

  async deleteBatch(
    userId: string,
    userName: string,
    batchId: string,
    domain?: ArchiveDomain,
  ): Promise<{ success: boolean; deletedCount: number; batchName?: string }> {
    this.logger.log(`deleteBatch: userId=${userId}, batchId=${batchId}, domain=${domain}`);
    const table = ContractService.tableFor(ContractService.resolveDomain(domain));

    const batchInfo = await this.db
      .select({ batchName: table.archiveBatchName })
      .from(table)
      .where(eq(table.archiveBatchId, sql`${batchId}::uuid`))
      .limit(1);

    const batchName = batchInfo[0]?.batchName;

    const result = await this.db
      .delete(table)
      .where(eq(table.archiveBatchId, sql`${batchId}::uuid`))
      .returning({ id: table.id });

    if (result.length > 0) {
      this.appendArchiveLog({
        operator: userName || userId,
        operate_time: new Date().toISOString(),
        count: -result.length,
        batch_name: batchName || batchId,
      }).catch(() => {});
    }

    return { success: true, deletedCount: result.length, batchName };
  }

  async clearRejectedBatches(
    userId: string,
    userName: string,
    domain?: ArchiveDomain,
  ): Promise<ContractClearRejectedResponse> {
    const d = ContractService.resolveDomain(domain);
    this.logger.log(`clearRejectedBatches: userId=${userId}, domain=${d}`);
    const table = ContractService.tableFor(d);

    const affected = await this.db
      .select({ batchId: table.archiveBatchId })
      .from(table)
      .where(eq(table.status, 'rejected'))
      .groupBy(table.archiveBatchId);

    const result = await this.db
      .delete(table)
      .where(eq(table.status, 'rejected'))
      .returning({ id: table.id });

    if (result.length > 0) {
      this.appendArchiveLog({
        operator: userName || userId,
        operate_time: new Date().toISOString(),
        count: -result.length,
        batch_name: `手动清理驳回数据（${ARCHIVE_DOMAIN_LABELS[d]}）`,
      }).catch(() => {});
    }

    return {
      success: true,
      deletedCount: result.length,
      clearedBatches: affected.length,
    };
  }

  async cleanExpiredRejected(days = 30): Promise<Record<ArchiveDomain, number>> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted: Record<ArchiveDomain, number> = {
      welding: 0,
      manufacturing: 0,
      painting: 0,
      stamping: 0,
    };
    for (const d of ARCHIVE_DOMAIN_VALUES) {
      const table = ContractService.tableFor(d);
      const result = await this.db
        .delete(table)
        .where(and(eq(table.status, 'rejected'), lt(table.reviewTime, cutoff)))
        .returning({ id: table.id });
      deleted[d] = result.length;
    }
    this.logger.log(
      `cleanExpiredRejected: days=${days}, cutoff=${cutoff.toISOString()}, deleted=${JSON.stringify(deleted)}`,
    );
    return deleted;
  }

  private static pdfStr(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    return String(value).trim();
  }

  private static pdfNum(value: unknown): number | undefined {
    const num =
      typeof value === 'number' ? value : parseFloat(ContractService.pdfStr(value).replace(/,/g, ''));
    return Number.isFinite(num) ? num : undefined;
  }

  private parseRowsJson(rowsJson: string): Record<string, unknown>[] {
    const cleaned = rowsJson
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      this.logger.error(`PDF 提取结果 JSON 解析失败: ${JSON.stringify(err)}`);
      throw new BadRequestException('合同数据提取结果格式异常，请重试或改用 Excel 模板上传');
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException('合同数据提取结果格式异常，请重试或改用 Excel 模板上传');
    }
    return parsed.filter(
      (item): item is Record<string, unknown> => item !== null && typeof item === 'object',
    );
  }

  private async runExtractionPipeline(
    filePath: string,
    lineType: LineType | undefined,
    domain: ArchiveDomain = 'welding',
  ): Promise<ExtractPdfContractsResponse> {
    const signedUrl = await this.fileService.createSignedUrl(filePath, 600);
    if (!signedUrl) {
      throw new BadRequestException('PDF 文件获取下载链接失败，请重试');
    }

    let parsed: FileParseTextOneOutput;
    try {
      parsed = (await this.callPluginWithTimeout('file_parse_text_1', 'parseDocToMarkdown', {
        fileUrl: [signedUrl],
      })) as FileParseTextOneOutput;
    } catch (err) {
      this.logger.error(
        `PDF 文档解析插件失败: ${serializePluginError(err)}`,
      );
      throw new BadRequestException('PDF 文档解析失败，请重试或改用 Excel 模板上传');
    }
    const content = typeof parsed?.content === 'string' ? parsed.content.trim() : '';
    if (!content) {
      throw new BadRequestException('未从 PDF 中解析出文本内容，请确认文件非扫描件');
    }

    return this.extractRowsFromText(content, lineType, domain);
  }

  async extractRowsFromText(
    text: string,
    lineType: LineType | undefined,
    domain: ArchiveDomain = 'welding',
    onProgress?: (done: number, total: number) => void,
  ): Promise<ExtractPdfContractsResponse> {
    if (text.length > ContractService.MAX_EXTRACT_CHARS) {
      throw new BadRequestException(
        `合同文本过长（${text.length} 字符，上限 ${ContractService.MAX_EXTRACT_CHARS}），请拆分文件后分次上传或改用 Excel 模板上传`,
      );
    }

    if (domain !== 'welding') {
      const items = await this.extractRowsWithSlices(
        'manufacturing_contract_detail_extract_1',
        'contract_content',
        text,
        onProgress,
      );

      const rows: ManufacturingContractRow[] = items
        .filter((item) => ContractService.pdfStr(item.device_material_name) !== '')
        .map((item): ManufacturingContractRow => ({
          project: ContractService.pdfStr(item.project),
          device_material_name: ContractService.pdfStr(item.device_material_name),
          specification: ContractService.pdfStr(item.specification) || undefined,
          unit_price: ContractService.pdfNum(item.unit_price) ?? 0,
          price_caliber: (ContractService.pdfStr(item.price_caliber) === '含税'
            ? '含税'
            : '未税') as PriceCaliber,
          unit: ContractService.pdfStr(item.unit) || undefined,
          settle_date: ContractService.pdfStr(item.settle_date),
          quantity: ContractService.pdfNum(item.quantity) ?? undefined,
          selected_brand: ContractService.pdfStr(item.selected_brand) || undefined,
          subtotal: ContractService.pdfNum(item.subtotal) ?? undefined,
          remark: ContractService.pdfStr(item.remark) || undefined,
        }));

      return { rows };
    }

    const items = await this.extractRowsWithSlices(
      'contract_detail_extract_1',
      'contract_text',
      text,
      onProgress,
    );

    const rows: ContractRow[] = items
      .filter((item) => ContractService.pdfStr(item.device_material_name) !== '')
      .map((item) => {
        const category = ContractService.pdfStr(item.category) || undefined;
        const usageRaw = ContractService.pdfStr(item.usage_scope) || category || '';
        const row: ContractRow = {
          project: ContractService.pdfStr(item.project),
          line_type: lineType || '主线',
          device_material_name: ContractService.pdfStr(item.device_material_name),
          usage_scope: (usageRaw === '通用' || usageRaw === 'general'
            ? '通用'
            : usageRaw
              ? '专用'
              : undefined) as UsageScope | undefined,
          distinction:
            (ContractService.pdfStr(item.distinction) || undefined) as ModifyLevel | undefined,
          copy_mode:
            (ContractService.pdfStr(item.copy_mode) || undefined) as CopyMode | undefined,
          unit_price: ContractService.pdfNum(item.unit_price) ?? 0,
          price_caliber: (ContractService.pdfStr(item.price_caliber) === '含税'
            ? '含税'
            : '未税') as PriceCaliber,
          supply: (ContractService.pdfStr(item.supply) || undefined) as SupplyType | undefined,
          unit: ContractService.pdfStr(item.unit) || undefined,
          settle_date: ContractService.pdfStr(item.settle_date),
          quantity: ContractService.pdfNum(item.quantity) ?? undefined,
          selected_brand: ContractService.pdfStr(item.selected_brand) || undefined,
          subtotal: ContractService.pdfNum(item.subtotal) ?? undefined,
          remark: ContractService.pdfStr(item.remark) || undefined,
          workstation_no: ContractService.pdfStr(item.workstation_no) || undefined,
          workstation_desc: ContractService.pdfStr(item.workstation_desc) || undefined,
        };
        if (category) row.category = category;
        return row;
      });

    return { rows };
  }

  async extractPdfContracts(
    dto: ExtractPdfContractsRequest,
  ): Promise<ExtractPdfContractsResponse> {
    const meta = await this.fileService.getFileMetadata(dto.file_path);
    if (!meta || !meta.filePath) {
      throw new BadRequestException('PDF 文件不存在或已被删除，请重新上传');
    }
    return this.runExtractionPipeline(meta.filePath, dto.line_type, dto.domain);
  }

  async extractPdfUpload(
    fileName: string,
    content: Buffer,
    lineType: LineType | undefined,
    domain: ArchiveDomain = 'welding',
  ): Promise<ExtractPdfContractsResponse> {
    const uploaded = await this.fileService.upload(content, {
      fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      contentType: 'application/pdf',
    });
    try {
      return await this.runExtractionPipeline(uploaded.filePath, lineType, domain);
    } finally {
      await this.fileService.remove([uploaded.filePath]).catch((err: unknown) => {
        this.logger.warn(`临时 PDF 清理失败: ${JSON.stringify(err)}`);
      });
    }
  }

  private static readonly PDF_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;
  private static readonly PDF_SESSION_TTL_MS = 30 * 60 * 1000;
  private static readonly EXTRACT_SLICE_CHARS = 8000;
  private static readonly MIN_RETRY_SLICE_CHARS = 800;
  private static readonly MAX_SPLIT_DEPTH = 3;
  private static readonly EXTRACT_CONCURRENCY = 3;
  private static readonly EXTRACT_TOTAL_DEADLINE_MS = 15 * 60 * 1000;
  private static readonly MAX_EXTRACT_CHARS = 300000;
  private static readonly PLUGIN_CALL_TIMEOUT_MS = 100000;
  private static readonly PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly ARCHIVE_LOG_MAX = 500;

  private async appendArchiveLog(entry: ArchiveLogEntry): Promise<void> {
    await this.db
      .insert(archiveLog)
      .values({
        operator: entry.operator,
        operateTime: entry.operate_time,
        count: entry.count,
        batchId: entry.batch_id ?? undefined,
        batchName: entry.batch_name ?? undefined,
        domain: entry.domain ?? undefined,
      });
  }

  private async purgeExpiredPreviews(): Promise<void> {
    const cutoff = Date.now() - ContractService.PREVIEW_TTL_MS;
    await this.db.delete(previewStore).where(lt(previewStore.createdAt, cutoff));
  }

  private static sliceExtractText(content: string): string[] {
    if (content.length <= ContractService.EXTRACT_SLICE_CHARS) {
      return [content];
    }
    const slices: string[] = [];
    let start = 0;
    while (start < content.length) {
      let end = Math.min(start + ContractService.EXTRACT_SLICE_CHARS, content.length);
      if (end < content.length) {
        const lastBreak = content.lastIndexOf('\n', end);
        if (lastBreak > start + ContractService.EXTRACT_SLICE_CHARS / 2) {
          end = lastBreak + 1;
        }
      }
      slices.push(content.slice(start, end));
      start = end;
    }
    return slices;
  }

  private async callPluginWithTimeout(
    instanceId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    return callCapabilityWithTimeout(
      this.capabilityService,
      instanceId,
      action,
      payload,
      ContractService.PLUGIN_CALL_TIMEOUT_MS,
    );
  }

  private static splitSliceInHalf(slice: string): [string, string] {
    const mid = Math.floor(slice.length / 2);
    let cut = slice.lastIndexOf('\n', mid);
    if (cut < Math.floor(ContractService.MIN_RETRY_SLICE_CHARS / 2)) {
      cut = mid;
    }
    return [slice.slice(0, cut), slice.slice(cut)];
  }

  private parseRowsJsonValue(extracted: unknown): Record<string, unknown>[] {
    const rowsJson = (extracted as { rowsJson?: unknown } | null)?.rowsJson;
    if (Array.isArray(rowsJson)) {
      return rowsJson.filter(
        (item): item is Record<string, unknown> => item !== null && typeof item === 'object',
      );
    }
    if (typeof rowsJson === 'string' && rowsJson.trim()) {
      return this.parseRowsJson(rowsJson);
    }
    return [];
  }

  private async extractRowsWithSlices(
    instanceId: string,
    textField: string,
    content: string,
    onProgress?: (done: number, total: number) => void,
  ): Promise<Record<string, unknown>[]> {
    if (content.length > ContractService.MAX_EXTRACT_CHARS) {
      throw new BadRequestException(
        `合同文本过长（${content.length} 字符，上限 ${ContractService.MAX_EXTRACT_CHARS}），请拆分文件后分次上传或改用 Excel 模板上传`,
      );
    }
    const slices = ContractService.sliceExtractText(content);
    this.logger.log(
      `合同文本分片提取: instance=${instanceId}, slices=${slices.length}, totalChars=${content.length}`,
    );
    const deadline = Date.now() + ContractService.EXTRACT_TOTAL_DEADLINE_MS;
    const results: Record<string, unknown>[][] = new Array(slices.length);
    let cursor = 0;
    let completed = 0;
    const worker = async (): Promise<void> => {
      while (cursor < slices.length) {
        const index = cursor;
        cursor += 1;
        if (Date.now() > deadline) {
          throw new BadRequestException(
            '合同提取总耗时超限，请拆分文件后分次上传或改用 Excel 模板上传',
          );
        }
        results[index] = await this.extractSingleSlice(instanceId, textField, slices[index], 0);
        completed += 1;
        onProgress?.(completed, slices.length);
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(ContractService.EXTRACT_CONCURRENCY, slices.length) },
        () => worker(),
      ),
    );
    return results.flat();
  }

  private async extractSingleSlice(
    instanceId: string,
    textField: string,
    slice: string,
    depth: number,
  ): Promise<Record<string, unknown>[]> {
    let err: unknown;
    try {
      return this.parseRowsJsonValue(
        await this.callPluginWithTimeout(instanceId, 'textToJson', { [textField]: slice }),
      );
    } catch (e) {
      err = e;
    }
    const isTimeout = err instanceof Error && err.message.includes('执行超时');
    if (isTimeout) {
      try {
        return this.parseRowsJsonValue(
          await this.callPluginWithTimeout(instanceId, 'textToJson', { [textField]: slice }),
        );
      } catch (e) {
        err = e;
      }
    }
    if (depth < ContractService.MAX_SPLIT_DEPTH && slice.length > ContractService.MIN_RETRY_SLICE_CHARS) {
      this.logger.warn(
        `合同提取分片失败，减半重试: chars=${slice.length}, depth=${depth}, err=${serializePluginError(err)}`,
      );
      const halves = ContractService.splitSliceInHalf(slice);
      const [first, second] = await Promise.all(
        halves.map((half: string) => this.extractSingleSlice(instanceId, textField, half, depth + 1)),
      );
      return [...first, ...second];
    }
    this.logger.error(`合同提取插件失败（已重试）: ${serializePluginError(err)}`);
    throw new BadRequestException('合同内容提取失败，请重试或改用 Excel 模板上传');
  }
}
