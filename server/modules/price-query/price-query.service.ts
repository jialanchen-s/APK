import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { contract, manufacturingContract, paintingContract, stampingContract } from '@server/database/schema';
import { eq, ne, and, like, desc, sql, avg, min, max, count, or, isNotNull, lt, gte, isNull } from 'drizzle-orm';
import type {
  PriceQueryParams,
  PriceQueryResponse,
  PriceQueryRecord,
  PriceQueryStats,
  ArchiveCounts,
  ArchiveDomain,
} from '@shared/api.interface';

@Injectable()
export class PriceQueryService {
  private readonly logger = new Logger(PriceQueryService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: any) {}

  private tableFor(domain?: ArchiveDomain) {
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

  async search(
    params: PriceQueryParams,
    page: number,
    pageSize: number,
  ): Promise<PriceQueryResponse> {
    this.logger.log(`search: deviceMaterialName=${params.device_material_name}, archivePeriod=${params.archive_period}, domain=${params.domain ?? 'welding'}, page=${page}, pageSize=${pageSize}`);

    const t = this.tableFor(params.domain);
    const recentDate = params.archive_period ? await this.getRecentArchiveDate(t) : null;
    const conditions = this.buildConditions(t, params, recentDate);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      this.db
        .select({
          id: t.id,
          project: t.project,
          lineType: t.lineType,
          deviceMaterialName: t.deviceMaterialName,
          supply: t.supply,
          unitPrice: t.unitPrice,
          priceCaliber: t.priceCaliber,
          settleDate: t.settleDate,
          category: t.category,
          selectedBrand: t.selectedBrand,
          workstationNo: t.workstationNo,
          workstationDesc: t.workstationDesc,
        })
        .from(t)
        .where(whereClause)
        .orderBy(desc(t.settleDate))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ cnt: count() })
        .from(t)
        .where(whereClause),
    ]);

    const items: PriceQueryRecord[] = rows.map((r) => ({
      id: r.id,
      project: r.project ?? '',
      line_type: (r.lineType ?? '主线') as any,
      device_material_name: r.deviceMaterialName ?? '',
      supply: (r.supply ?? '乙供') as any,
      unit_price: parseFloat(r.unitPrice ?? '0'),
      price_caliber: (r.priceCaliber ?? '未税') as any,
      settle_date: r.settleDate instanceof Date ? r.settleDate.toISOString() : String(r.settleDate ?? ''),
      category: r.category ?? undefined,
      selected_brand: r.selectedBrand ?? undefined,
      workstation_no: r.workstationNo ?? undefined,
      workstation_desc: r.workstationDesc ?? undefined,
    }));

    const stats = await this.getStatsInternal(t, params, recentDate);
    const crossLine = await this.getCrossLineReference(t, params, recentDate);

    return {
      items,
      total: Number(countResult[0]?.cnt ?? 0),
      reference_price: stats.avg_price,
      reference_count: stats.count,
      reference_note: this.buildReferenceNote(stats),
      cross_line_price: crossLine?.price,
      cross_line_type: crossLine?.lineType,
      cross_line_count: crossLine?.count,
      cross_line_note: crossLine?.note,
    };
  }

  private async getCrossLineReference(
    t: typeof contract | typeof manufacturingContract | typeof paintingContract | typeof stampingContract,
    params: PriceQueryParams,
    recentDate: Date | null,
  ): Promise<{ price: number; lineType: string; count: number; note: string } | null> {
    if (!params.line_type || params.line_type === '全部') return null;

    const conditions = [
      eq(t.status, 'approved'),
      ne(t.lineType, params.line_type),
    ];

    if (params.device_material_name) {
      conditions.push(like(t.deviceMaterialName, `%${params.device_material_name}%`));
    }
    if (params.project) {
      conditions.push(like(t.project, `%${params.project}%`));
    }
    if (params.usage_scope && params.usage_scope !== '不限') {
      conditions.push(eq(t.usageScope, params.usage_scope));
    }
    if (params.supply && params.supply !== '不限') {
      conditions.push(eq(t.supply, params.supply));
    }
    if (params.archive_period && recentDate) {
      if (params.archive_period === 'recent') {
        conditions.push(gte(t.archiveTime, recentDate));
      } else {
        conditions.push(or(lt(t.archiveTime, recentDate), isNull(t.archiveTime)));
      }
    }

    const rows = await this.db
      .select({
        lineType: t.lineType,
        avgPrice: avg(sql`CAST(${t.unitPrice} AS numeric)`),
        cnt: sql<number>`count(*)`,
      })
      .from(t)
      .where(and(...conditions))
      .groupBy(t.lineType)
      .orderBy(desc(sql`count(*)`));

    if (rows.length === 0) return null;

    const best = rows[0];
    if (!best.lineType || !best.avgPrice) return null;

    const price = parseFloat(best.avgPrice);
    const cnt = Number(best.cnt);
    return {
      price,
      lineType: best.lineType,
      count: cnt,
      note: `跨线参考：${best.lineType} ${price.toFixed(1)} 元（${cnt}条记录，仅供参考）`,
    };
  }

  async getStats(params: PriceQueryParams): Promise<PriceQueryStats> {
    const t = this.tableFor(params.domain);
    const recentDate = params.archive_period ? await this.getRecentArchiveDate(t) : null;
    return this.getStatsInternal(t, params, recentDate);
  }

  private async getStatsInternal(
    t: typeof contract | typeof manufacturingContract | typeof paintingContract | typeof stampingContract,
    params: PriceQueryParams,
    recentDate?: Date | null,
  ): Promise<PriceQueryStats> {
    const conditions = this.buildConditions(t, params, recentDate);

    const result = await this.db
      .select({
        avgPrice: avg(sql`CAST(${t.unitPrice} AS numeric)`),
        minPrice: min(sql`CAST(${t.unitPrice} AS numeric)`),
        maxPrice: max(sql`CAST(${t.unitPrice} AS numeric)`),
        cnt: count(),
      })
      .from(t)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const row = result[0];

    return {
      avg_price: parseFloat(row?.avgPrice ?? '0'),
      min_price: parseFloat(row?.minPrice ?? '0'),
      max_price: parseFloat(row?.maxPrice ?? '0'),
      count: Number(row?.cnt ?? 0),
      line_type: params.line_type && params.line_type !== '全部' ? params.line_type : '全部线别',
    };
  }

  private async getRecentArchiveDate(
    t: typeof contract | typeof manufacturingContract | typeof paintingContract | typeof stampingContract,
  ): Promise<Date | null> {
    const result = await this.db
      .select({ maxDate: max(t.archiveTime) })
      .from(t)
      .where(and(eq(t.status, 'approved'), isNotNull(t.archiveTime)));
    const maxDate = result[0]?.maxDate;
    if (!maxDate) return null;
    const d = new Date(maxDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async getArchiveCounts(domain?: ArchiveDomain): Promise<ArchiveCounts> {
    const t = this.tableFor(domain);
    const recentDate = await this.getRecentArchiveDate(t);
    if (!recentDate) {
      const result = await this.db.select({ cnt: count() }).from(t).where(eq(t.status, 'approved'));
      const total = Number(result[0]?.cnt ?? 0);
      return { recent: 0, history: total };
    }

    const [recentResult, historyResult] = await Promise.all([
      this.db.select({ cnt: count() }).from(t).where(and(eq(t.status, 'approved'), gte(t.archiveTime, recentDate))),
      this.db.select({ cnt: count() }).from(t).where(and(eq(t.status, 'approved'), or(lt(t.archiveTime, recentDate), isNull(t.archiveTime)))),
    ]);

    return {
      recent: Number(recentResult[0]?.cnt ?? 0),
      history: Number(historyResult[0]?.cnt ?? 0),
    };
  }

  private buildConditions(
    t: typeof contract | typeof manufacturingContract | typeof paintingContract | typeof stampingContract,
    params: PriceQueryParams,
    recentDate?: Date | null,
  ) {
    const conditions = [eq(t.status, 'approved')];

    if (params.device_material_name) {
      conditions.push(like(t.deviceMaterialName, `%${params.device_material_name}%`));
    }

    if (params.project) {
      conditions.push(like(t.project, `%${params.project}%`));
    }

    if (params.line_type && params.line_type !== '全部') {
      conditions.push(eq(t.lineType, params.line_type));
    }

    if (params.usage_scope && params.usage_scope !== '不限') {
      conditions.push(eq(t.usageScope, params.usage_scope));
    }

    if (params.supply && params.supply !== '不限') {
      conditions.push(eq(t.supply, params.supply));
    }

    if (params.archive_period) {
      if (recentDate) {
        if (params.archive_period === 'recent') {
          conditions.push(gte(t.archiveTime, recentDate));
        } else {
          conditions.push(or(lt(t.archiveTime, recentDate), isNull(t.archiveTime)));
        }
      } else if (params.archive_period === 'recent') {
        conditions.push(sql`false`);
      }
    }

    return conditions;
  }

  private buildReferenceNote(stats: PriceQueryStats): string {
    if (stats.count === 0) {
      return '暂无匹配的历史合同数据';
    }
    return `近${stats.count}条合同均价（${stats.line_type}），价格区间 ${stats.min_price.toFixed(1)}-${stats.max_price.toFixed(1)} 元`;
  }
}
