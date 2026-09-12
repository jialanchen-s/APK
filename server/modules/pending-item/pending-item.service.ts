import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { pendingItem, estimateTask, model } from '@server/database/schema';
import { eq, and, sql, count, inArray, desc } from 'drizzle-orm';
import { ModelService } from '../model/model.service';
import { EstimateTaskService } from '../estimate-task/estimate-task.service';
import type {
  PendingGroupsResponse,
  PendingItemListResponse,
  BatchApplyResponse,
  SubmitPendingResponse,
  ApplyModelResponse,
  PendingItem,
  PendingItemParam,
  PendingGroupType,
  PendingItemStatus,
  LineType,
} from '@shared/api.interface';

@Injectable()
export class PendingItemService {
  private readonly logger = new Logger(PendingItemService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: any,
    private readonly modelService: ModelService,
    private readonly estimateTaskService: EstimateTaskService,
  ) {}

  async cancelTaskPendingItems(taskId: string): Promise<void> {
    this.logger.log(`cancelTaskPendingItems: taskId=${taskId}`);
    await this.db
      .update(pendingItem)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(pendingItem.taskId, taskId),
          sql`${pendingItem.status} IS DISTINCT FROM 'submitted'`,
        ),
      );
    await this.db
      .update(estimateTask)
      .set({ pendingRows: 0 })
      .where(eq(estimateTask.id, taskId));
  }

  async getLatestTask(): Promise<{ id: string; file_name: string; status: string } | null> {
    this.logger.log('getLatestTask');
    const rows = await this.db
      .select({
        id: estimateTask.id,
        fileName: estimateTask.fileName,
        status: estimateTask.status,
      })
      .from(estimateTask)
      .orderBy(desc(estimateTask.createdAt))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    return { id: row.id, file_name: row.fileName, status: row.status ?? 'pending' };
  }

  async getGroups(taskId: string): Promise<PendingGroupsResponse> {
    this.logger.log(`getGroups: taskId=${taskId}`);
    const rows = await this.db
      .select({ groupType: pendingItem.groupType, cnt: count() })
      .from(pendingItem)
      .where(
        and(
          eq(pendingItem.taskId, taskId),
          sql`${pendingItem.status} IS DISTINCT FROM 'submitted'`,
          sql`${pendingItem.status} IS DISTINCT FROM 'cancelled'`,
        ),
      )
      .groupBy(pendingItem.groupType);

    const groups = rows.map((r) => ({
      type: r.groupType as PendingGroupType,
      count: Number(r.cnt),
    }));
    return { groups };
  }

  async getItems(
    taskId: string,
    groupType: string,
    page: number,
    pageSize: number,
  ): Promise<PendingItemListResponse> {
    this.logger.log(
      `getItems: taskId=${taskId}, groupType=${groupType}, page=${page}, pageSize=${pageSize}`,
    );
    const offset = (page - 1) * pageSize;

    const [items, totalRows] = await Promise.all([
      this.db
        .select()
        .from(pendingItem)
        .where(
          and(
            eq(pendingItem.taskId, taskId),
            eq(pendingItem.groupType, groupType),
            sql`${pendingItem.status} IS DISTINCT FROM 'submitted'`,
            sql`${pendingItem.status} IS DISTINCT FROM 'cancelled'`,
          ),
        )
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ cnt: count() })
        .from(pendingItem)
        .where(
          and(
            eq(pendingItem.taskId, taskId),
            eq(pendingItem.groupType, groupType),
            sql`${pendingItem.status} IS DISTINCT FROM 'submitted'`,
            sql`${pendingItem.status} IS DISTINCT FROM 'cancelled'`,
          ),
        ),
    ]);

    const mappedItems: PendingItem[] = items.map((row) => {
      const filledValues = (row.filledValues as Record<string, string | number>) ?? {};
       return {
         id: row.id,
         task_id: row.taskId ?? '',
         group_type: row.groupType as PendingGroupType,
         model_id: row.modelId ?? undefined,
         device_name: row.deviceName,
         line_type: (filledValues._line_type as string ?? '') as LineType,
         params: (row.params as PendingItemParam[]) ?? [],
         filled_values: filledValues,
         spec_remark: row.specRemark ?? undefined,
         status: (row.status ?? 'pending') as PendingItemStatus,
       };
    });

    return { items: mappedItems, total: Number(totalRows[0]?.cnt ?? 0) };
  }

  async batchApply(
    taskId: string,
    itemIds: string[],
    params: Record<string, string | number>,
  ): Promise<BatchApplyResponse> {
    this.logger.log(`batchApply: taskId=${taskId}, itemIds=${JSON.stringify(itemIds)}`);
    await this.db
      .update(pendingItem)
      .set({
        filledValues: sql`${pendingItem.filledValues} || ${JSON.stringify(params)}::jsonb`,
        status: 'filled',
      })
      .where(and(eq(pendingItem.taskId, taskId), inArray(pendingItem.id, itemIds)));
    return { success: true };
  }

  async submit(
    taskId: string,
    items: { id: string; params: Record<string, string | number>; manual_price?: number }[],
  ): Promise<SubmitPendingResponse> {
    this.logger.log(`submit: taskId=${taskId}, itemsCount=${items.length}`);

    let pricedCount = 0;

    for (const item of items) {
      const pendingRows = await this.db
        .select()
        .from(pendingItem)
        .where(eq(pendingItem.id, item.id))
        .limit(1);
      if (pendingRows.length === 0) continue;
      const pendingRow = pendingRows[0];

      const manualPrice = Number(item.manual_price);
      const hasManualPrice = Number.isFinite(manualPrice) && manualPrice > 0;

      if (hasManualPrice) {
        const filled = (pendingRow.filledValues as Record<string, string | number>) ?? {};
        const modifyLevel = String(
          item.params._modify_level ?? item.params.modify_level ?? filled._modify_level ?? '',
        );
        const quantity = Number(item.params._quantity ?? filled._quantity) || 1;
        await this.estimateTaskService.updateRowResult(
          taskId,
          pendingRow.deviceName,
          modifyLevel,
          {
            status: 'success',
            price: manualPrice,
            total_price: manualPrice * quantity,
            source: '人工填报',
            match_level: '人工直填价格',
            remark: '人工填报单价，直接计入成果单',
          },
        );
        pricedCount++;
      } else if (pendingRow.modelId) {
        const modelRows = await this.db
          .select()
          .from(model)
          .where(eq(model.modelId, pendingRow.modelId))
          .limit(1);
        if (modelRows.length > 0 && modelRows[0].formulaLogic) {
          const modelRow = modelRows[0];
          const constants = (modelRow.constants as Record<string, string | number>) ?? {};
          const allParams: Record<string, string | number> = { ...constants, ...item.params };
          const result = this.modelService.evaluateFormula(
            modelRow.formulaLogic,
            allParams,
            constants,
          );
          if (result.success && result.result && result.result > 0) {
            const filled = (pendingRow.filledValues as Record<string, string | number>) ?? {};
            const modifyLevel = String(
              item.params._modify_level ?? item.params.modify_level ?? filled._modify_level ?? '',
            );
            const quantity = Number(item.params._quantity ?? filled._quantity) || 1;
            await this.estimateTaskService.updateRowResult(
              taskId,
              pendingRow.deviceName,
              modifyLevel,
              {
                status: 'success',
                price: result.result,
                total_price: result.result * quantity,
                source: `人工填报(${modelRow.modelName})`,
                match_level: '模型公式-人工填报',
                remark: `模型:${modelRow.modelName} 人工填报参数计算`,
              },
            );
            pricedCount++;
          } else {
            this.logger.warn(`公式计算失败: device=${pendingRow.deviceName}, error=${result.error ?? 'unknown'}`);
          }
        }
      }

      await this.db
        .update(pendingItem)
        .set({ status: 'submitted' })
        .where(eq(pendingItem.id, item.id));
    }

    await this.db
      .update(estimateTask)
      .set({ pendingRows: sql`${estimateTask.pendingRows} - ${items.length}` })
      .where(eq(estimateTask.id, taskId));

    this.logger.log(`submit完成: 共${items.length}项, ${pricedCount}项成功定价`);

    return { success: true, main_result_url: '', unknown_result_url: '' };
  }

  async applyModel(
    taskId: string,
    itemIds: string[],
    modelId: string,
    paramValues?: Record<string, string | number>,
  ): Promise<ApplyModelResponse> {
    this.logger.log(`applyModel: taskId=${taskId}, itemIds=${JSON.stringify(itemIds)}, modelId=${modelId}`);

    // 查询模型
    const modelRows = await this.db
      .select()
      .from(model)
      .where(eq(model.modelId, modelId))
      .limit(1);

    if (modelRows.length === 0) {
      return { success: false, appliedCount: 0 };
    }

    const modelRow = modelRows[0];
    const inputVars = (modelRow.inputVars ?? []) as Array<{
      name: string; type: string; required: boolean; defaultValue?: string | number;
    }>;

    // 读取待更新项的现有 metadata（_line_type / _modify_level / _quantity），
    // 避免 applyModel 重建 params 时丢失，导致 submit 里 updateRowResult 的
    // modify_level 等值匹配失败、价格回写不到成果单。
    const existingRows = await this.db
      .select({ id: pendingItem.id, params: pendingItem.params, filledValues: pendingItem.filledValues })
      .from(pendingItem)
      .where(and(eq(pendingItem.taskId, taskId), inArray(pendingItem.id, itemIds)));

    const metadataByItemId = new Map<string, Record<string, string | number>>();
    for (const r of existingRows) {
      const existingParams = (r.params as Array<{ name: string; value?: string | number }>) ?? [];
      const filled = (r.filledValues as Record<string, string | number>) ?? {};
      const pick = (name: string) => {
        const fromParams = existingParams.find((p) => p.name === name)?.value;
        if (fromParams !== undefined && fromParams !== '') return fromParams;
        const fromFilled = filled[name];
        if (fromFilled !== undefined && fromFilled !== '') return fromFilled;
        return '';
      };
      metadataByItemId.set(r.id, {
        _line_type: pick('_line_type'),
        _modify_level: pick('_modify_level'),
        _quantity: pick('_quantity'),
      });
    }

    // 更新选中的 pending_item：按项合并「模型参数 + 保留的 metadata」
    let appliedCount = 0;
    for (const r of existingRows) {
      const meta = metadataByItemId.get(r.id) ?? {};
      const modelEntries = inputVars.map((v) => {
        const userVal = paramValues?.[v.name];
        const value = userVal !== undefined && userVal !== ''
          ? userVal
          : (v.defaultValue ?? '');
        return {
          name: v.name,
          type: v.type,
          required: v.required,
          value,
        };
      });
      const metaEntries = Object.entries(meta)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([name, value]) => ({ name, type: 'string', required: false, value }));
      await this.db
        .update(pendingItem)
        .set({
          modelId: modelId,
          groupType: 'model_param',
          params: [...modelEntries, ...metaEntries],
          status: 'pending',
        })
        .where(eq(pendingItem.id, r.id));
      appliedCount++;
    }

    this.logger.log(`applyModel完成: 成功应用${appliedCount}项`);

    return { success: true, appliedCount };
  }
}
