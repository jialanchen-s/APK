import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { contract } from '@server/database/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type {
  ParseContractRequest,
  ContractParseResponse,
  ContractPreviewResponse,
  ContractPreviewItem,
  ContractPreviewStatus,
  ContractArchiveResponse,
  ContractArchiveLogsResponse,
  ContractArchiveLog,
  ContractRow,
  LineType,
  UsageScope,
  ModifyLevel,
  CopyMode,
  PriceCaliber,
  SupplyType,
  ContractReviewStatus,
  ContractReviewListResponse,
  ContractReviewBatch,
  ContractReviewActionResponse,
  ContractReviewDetailItem,
  ContractReviewDetailResponse,
} from '@shared/api.interface';

interface StoredPreviewItem extends ContractPreviewItem {}

interface ArchiveLogEntry {
  operator: string;
  operate_time: string;
  count: number;
  batch_id?: string;
  batch_name?: string;
}

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);
  private readonly previewStore = new Map<string, StoredPreviewItem[]>();
  private readonly archiveLogStore: ArchiveLogEntry[] = [];

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async parseContract(
    userId: string,
    data: ParseContractRequest,
  ): Promise<ContractParseResponse> {
    this.logger.log(
      `parseContract: userId=${userId}, fileName=${data.file_name}, rows=${data.rows.length}`,
    );

    const previewId = `preview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const items: StoredPreviewItem[] = data.rows.map(
      (row: ContractRow, index: number) => {
        let status: ContractPreviewStatus = 'valid';
        let invalidReason: string | undefined;

        if (row.unit_price < 0 || row.unit_price > 10000000) {
          status = 'invalid';
          invalidReason = '价格异常';
        }

        return {
          id: `item_${index}`,
          project: row.project,
          line_type: row.line_type,
          device_material_name: row.device_material_name,
          usage_scope: row.usage_scope,
          category: row.category,
          distinction: row.distinction,
          copy_mode: row.copy_mode,
          unit_price: row.unit_price,
          price_caliber: row.price_caliber,
          supply: row.supply,
          unit: row.unit,
          settle_date: row.settle_date,
          status,
          invalidReason,
          quantity: row.quantity,
          selected_brand: row.selected_brand,
          subtotal: row.subtotal,
          remark: row.remark,
          workstation_no: row.workstation_no,
          workstation_desc: row.workstation_desc,
        };
      },
    );

    this.previewStore.set(previewId, items);

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
  ): Promise<ContractPreviewResponse> {
    this.logger.log(
      `getPreview: previewId=${previewId}, page=${page}, pageSize=${pageSize}`,
    );
    const items = this.previewStore.get(previewId) ?? [];
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    return { items: paged, total: items.length };
  }

  async archive(
    userId: string,
    userName: string,
    previewId: string,
    itemIds: string[],
    batchName?: string,
  ): Promise<ContractArchiveResponse> {
    this.logger.log(
      `archive: userId=${userId}, previewId=${previewId}, itemIds=${itemIds.length}`,
    );
    const items = this.previewStore.get(previewId) ?? [];
    const toArchive = items.filter(
      (i) => itemIds.includes(i.id) && i.status === 'valid',
    );

    if (toArchive.length === 0) {
      return { success: true, archivedCount: 0 };
    }

    const batchId = randomUUID();
    const now = new Date();
    const defaultBatchName = this.generateBatchName(toArchive);
    const finalBatchName = batchName || defaultBatchName;

    await this.db.insert(contract).values(
      toArchive.map((item) => ({
        project: item.project,
        lineType: item.line_type,
        deviceMaterialName: item.device_material_name,
        usageScope: item.usage_scope,
        category: item.category,
        distinction: item.distinction,
        copyMode: item.copy_mode,
        unitPrice: String(item.unit_price),
        priceCaliber: item.price_caliber,
        supply: item.supply,
        unit: item.unit,
        settleDate: now,
        archiveTime: now,
        archiveBatchId: batchId,
        archiveBatchName: finalBatchName,
        quantity: item.quantity != null ? String(item.quantity) : undefined,
        selectedBrand: item.selected_brand,
        subtotal: item.subtotal != null ? String(item.subtotal) : undefined,
        remark: item.remark,
        workstationNo: item.workstation_no,
        workstationDesc: item.workstation_desc,
        archiveOperator: userId,
        status: 'pending_review',
        createdBy: userId,
        updatedBy: userId,
      })),
    );

    this.archiveLogStore.push({
      operator: userName || userId,
      operate_time: now.toISOString(),
      count: toArchive.length,
      batch_id: batchId,
      batch_name: finalBatchName,
    });

    this.previewStore.delete(previewId);

    return { success: true, archivedCount: toArchive.length, batchId: String(batchId), batchName: finalBatchName };
  }

  async getPendingReviews(): Promise<ContractReviewListResponse> {
    this.logger.log('getPendingReviews');
    const result = await this.db
      .select({
        batchId: contract.archiveBatchId,
        batchName: contract.archiveBatchName,
        count: sql<number>`count(*)::int`,
        submitter: contract.archiveOperator,
        submitTime: sql<string>`max(${contract.archiveTime})::text`,
        lineType: sql<string>`max(${contract.lineType})`,
      })
      .from(contract)
      .where(sql`${contract.status} = 'pending_review' AND ${contract.archiveBatchId} IS NOT NULL`)
      .groupBy(contract.archiveBatchId, contract.archiveBatchName, contract.archiveOperator)
      .orderBy(sql`max(${contract.archiveTime}) DESC`);

    const batches: ContractReviewBatch[] = result.map((r) => ({
      batchId: String(r.batchId),
      batchName: r.batchName || '未命名批次',
      count: r.count,
      submitter: r.submitter || '',
      submitTime: r.submitTime || '',
      status: 'pending_review' as const,
      lineType: r.lineType || undefined,
    }));
    return { batches };
  }

  async getBatchDetail(batchId: string, page: number, pageSize: number): Promise<ContractReviewDetailResponse> {
    this.logger.log(`getBatchDetail: batchId=${batchId}, page=${page}, pageSize=${pageSize}`);
    const offset = (page - 1) * pageSize;
    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(contract)
        .where(sql`${contract.archiveBatchId} = ${batchId}::uuid`),
      this.db
        .select({
          id: contract.id,
          project: contract.project,
          lineType: contract.lineType,
          deviceMaterialName: contract.deviceMaterialName,
          usageScope: contract.usageScope,
          category: contract.category,
          distinction: contract.distinction,
          copyMode: contract.copyMode,
          unitPrice: contract.unitPrice,
          priceCaliber: contract.priceCaliber,
          supply: contract.supply,
          unit: contract.unit,
          settleDate: contract.settleDate,
          quantity: contract.quantity,
          selectedBrand: contract.selectedBrand,
          subtotal: contract.subtotal,
          remark: contract.remark,
          workstationNo: contract.workstationNo,
          workstationDesc: contract.workstationDesc,
          status: contract.status,
        })
        .from(contract)
        .where(sql`${contract.archiveBatchId} = ${batchId}::uuid`)
        .orderBy(contract.archiveTime)
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
      settle_date: r.settleDate ? new Date(r.settleDate).toISOString().slice(0, 10) : '',
      quantity: r.quantity != null ? parseFloat(String(r.quantity)) : undefined,
      selected_brand: r.selectedBrand || undefined,
      subtotal: r.subtotal != null ? parseFloat(String(r.subtotal)) : undefined,
      remark: r.remark || undefined,
      workstation_no: r.workstationNo || undefined,
      workstation_desc: r.workstationDesc || undefined,
      status: (r.status || 'pending_review') as ContractReviewStatus,
    }));
    return { items, total };
  }

  async approveBatch(
    userId: string,
    userName: string,
    batchId: string,
    remark?: string,
  ): Promise<ContractReviewActionResponse> {
    this.logger.log(`approveBatch: userId=${userId}, batchId=${batchId}`);
    const now = new Date();
    const result = await this.db
      .update(contract)
      .set({
        status: 'approved',
        reviewer: userId,
        reviewTime: now,
        reviewRemark: remark,
        updatedBy: userId,
      })
      .where(sql`${contract.archiveBatchId} = ${batchId}::uuid AND ${contract.status} = 'pending_review'`)
      .returning({ id: contract.id });

    this.logger.log(`approveBatch: approved ${result.length} items by ${userName || userId}`);
    return { success: true, affectedCount: result.length };
  }

  async rejectBatch(
    userId: string,
    userName: string,
    batchId: string,
    remark?: string,
  ): Promise<ContractReviewActionResponse> {
    this.logger.log(`rejectBatch: userId=${userId}, batchId=${batchId}`);
    const now = new Date();
    const result = await this.db
      .update(contract)
      .set({
        status: 'rejected',
        reviewer: userId,
        reviewTime: now,
        reviewRemark: remark,
        updatedBy: userId,
      })
      .where(sql`${contract.archiveBatchId} = ${batchId}::uuid AND ${contract.status} = 'pending_review'`)
      .returning({ id: contract.id });

    this.logger.log(`rejectBatch: rejected ${result.length} items by ${userName || userId}`);
    return { success: true, affectedCount: result.length };
  }

  private generateBatchName(items: StoredPreviewItem[]): string {
    if (items.length === 0) return '未命名批次';
    const firstItem = items[0];
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const lineType = firstItem.line_type || '未知线别';
    const projectSet = new Set(items.map((i) => i.project).filter(Boolean));
    const projectLabel =
      projectSet.size === 0
        ? '未指定项目'
        : projectSet.size === 1
          ? [...projectSet][0]
          : `${projectSet.size}个项目`;
    return `${dateStr}_${projectLabel}_${lineType}_${items.length}条`;
  }

  async getArchiveLogs(limit: number): Promise<ContractArchiveLogsResponse> {
    this.logger.log(`getArchiveLogs: limit=${limit}`);
    const logs: ContractArchiveLog[] = this.archiveLogStore
      .slice(-limit)
      .reverse();
    return { logs };
  }

  async deleteContracts(
    userId: string,
    userName: string,
    ids: string[],
  ): Promise<{ success: boolean; deletedCount: number }> {
    this.logger.log(
      `deleteContracts: userId=${userId}, userName=${userName}, ids=${ids.length}`,
    );

    if (ids.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const result = await this.db
      .delete(contract)
      .where(inArray(contract.id, ids))
      .returning({ id: contract.id });

    this.archiveLogStore.push({
      operator: userName || userId,
      operate_time: new Date().toISOString(),
      count: -result.length,
    });

    return { success: true, deletedCount: result.length };
  }

  async getArchiveBatches(): Promise<{
    batchId: string;
    batchName: string;
    count: number;
    archiveTime: string;
    status: string;
    reviewRemark: string | null;
    reviewTime: string | null;
  }[]> {
    this.logger.log('getArchiveBatches');
    const result = await this.db
      .select({
        batchId: contract.archiveBatchId,
        batchName: contract.archiveBatchName,
        count: sql<number>`count(*)::int`,
        archiveTime: sql<string>`max(${contract.archiveTime})::text`,
        status: sql<string>`max(${contract.status})`,
        reviewRemark: sql<string | null>`max(${contract.reviewRemark})`,
        reviewTime: sql<string | null>`max(${contract.reviewTime})::text`,
      })
      .from(contract)
      .where(sql`${contract.archiveBatchId} IS NOT NULL`)
      .groupBy(contract.archiveBatchId, contract.archiveBatchName)
      .orderBy(sql`max(${contract.archiveTime}) DESC`);

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

  async deleteBatch(
    userId: string,
    userName: string,
    batchId: string,
  ): Promise<{ success: boolean; deletedCount: number; batchName?: string }> {
    this.logger.log(`deleteBatch: userId=${userId}, batchId=${batchId}`);

    const batchInfo = await this.db
      .select({ batchName: contract.archiveBatchName })
      .from(contract)
      .where(eq(contract.archiveBatchId, sql`${batchId}::uuid`))
      .limit(1);

    const batchName = batchInfo[0]?.batchName;

    const result = await this.db
      .delete(contract)
      .where(eq(contract.archiveBatchId, sql`${batchId}::uuid`))
      .returning({ id: contract.id });

    if (result.length > 0) {
      this.archiveLogStore.push({
        operator: userName || userId,
        operate_time: new Date().toISOString(),
        count: -result.length,
        batch_name: batchName || batchId,
      });
    }

    return { success: true, deletedCount: result.length, batchName };
  }
}
