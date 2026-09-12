import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { FileStorageService } from '@server/common/file/file-storage.service';
import { eq, and, count, desc, like, or, inArray, ne, sql } from 'drizzle-orm';
import {
  estimateTask as estimateTasks,
  pendingItem as pendingItems,
  contract as contracts,
  manufacturingContract as manufacturingContracts,
  paintingContract as paintingContracts,
  stampingContract as stampingContracts,
  model as models,
} from '@server/database/schema';
import type {
  CreateEstimateTaskRequest,
  CreateEstimateTaskResponse,
  EstimateTask,
  EstimateTaskItem,
  EstimateTaskItemListResponse,
  EstimateItemFilter,
  PendingGroupType,
  LineType,
  EstimateMode,
  AnomalyDetectionResult,
  ContractProjectsResponse,
  ArchiveDomain,
} from '@shared/api.interface';
import type { WeldingCostAnomalyDetectionOneOutput, WeldingEquipmentParamExtractOneOutput } from '@shared/plugin-types';
import { ModelService } from '../model/model.service';
import { AIGatewayService } from '@server/common/ai/ai-gateway.service';

interface PublishedModel {
  id: string;
  modelId: string;
  modelName: string;
  applicableType: string | null;
  inputVars: unknown;
  formulaLogic: string | null;
  constants: unknown;
  status: string;
}

interface RowResult {
  status: 'success' | 'jia_gong' | 'pending';
  device_name: string;
  line_type: string;
  quantity: number;
  unit: string;
  usage_scope: string;
  supply_type: string;
  modify_level: string;
  copy_mode: string;
  price: number;
  total_price: number;
  source: string;
  match_level: string;
  remark: string;
  group_type?: PendingGroupType;
  workstation_no?: string;
  workstation_desc?: string;
  brand?: string;
  category?: string;
  distinction?: string;
  spec_remark?: string;
}

interface ContractMatchResult {
  id: string;
  avgPrice: number;
  projects: string;
  brands: string;
  lineType: string;
}

@Injectable()
export class EstimateTaskService {
  private readonly logger = new Logger(EstimateTaskService.name);
  private readonly aiParamsCache = new Map<string, Record<string, string | number>>();

  private tableFor(domain: ArchiveDomain = 'welding') {
    switch (domain) {
      case 'manufacturing':
        return manufacturingContracts;
      case 'painting':
        return paintingContracts;
      case 'stamping':
        return stampingContracts;
      default:
        return contracts;
    }
  }

  private static normalizeDomain(domain?: ArchiveDomain): ArchiveDomain {
    return domain === 'manufacturing' || domain === 'painting' || domain === 'stamping' ? domain : 'welding';
  }

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: any,
    private readonly modelService: ModelService,
    private readonly aiGateway: AIGatewayService,
    private readonly fileService: FileStorageService,
  ) {}

  private async loadRowResults(taskId: string): Promise<RowResult[]> {
    const rows = await this.db
      .select({ rowResults: estimateTasks.rowResults })
      .from(estimateTasks)
      .where(eq(estimateTasks.id, taskId))
      .limit(1);
    if (rows.length === 0 || !rows[0].rowResults) return [];
    return rows[0].rowResults as RowResult[];
  }

  async createTask(
    userId: string,
    data: CreateEstimateTaskRequest,
  ): Promise<CreateEstimateTaskResponse> {
    const domain = EstimateTaskService.normalizeDomain(data.domain);
    this.logger.log(
      `createTask: userId=${userId}, fileName=${data.file_name}, lineType=${data.line_type}, rows=${data.rows.length}, domain=${domain}`,
    );

    // 0. 清理之前所有任务的 pending_item 和 estimate_task（工作台只展示最新任务的数据）
    await this.db.delete(pendingItems);
    await this.db.delete(estimateTasks);
    this.logger.log('已清理旧任务的 pending_item 和 estimate_task 记录');

    // 1. 插入 estimate_task 记录，status=processing
    const [taskRow] = await this.db
      .insert(estimateTasks)
      .values({
        fileName: data.file_name,
        status: 'processing',
        totalRows: data.rows.length,
        domain,
      })
      .returning({ id: estimateTasks.id });

    const taskId: string = taskRow.id;
    const estimateMode: EstimateMode = data.estimate_mode ?? 'standard';
    const targetProjects: string[] = data.target_projects ?? [];

    // 2. 异步处理（不阻塞响应，前端轮询获取状态）
    this.processTask(taskId, data.rows, data.line_type, estimateMode, targetProjects, domain).catch((err) => {
      this.logger.error(`任务处理失败: taskId=${taskId}`, {
        error: err instanceof Error ? err.stack : String(err),
      });
      this.db
        .update(estimateTasks)
        .set({ status: 'failed' })
        .where(eq(estimateTasks.id, taskId))
        .catch((err) => this.logger.warn('标记任务失败状态时出错', err));
    });

    return { id: taskId, status: 'processing' };
  }

  private async processTask(
    taskId: string,
    rows: CreateEstimateTaskRequest['rows'],
    lineType: LineType,
    estimateMode: EstimateMode,
    targetProjects: string[] = [],
    domain: ArchiveDomain = 'welding',
  ): Promise<void> {
    const taskLineType: LineType = lineType;

    // 1. 缓存已发布模型（全任务只查一次）
    const publishedModels = await this.db
      .select({
        id: models.id,
        modelId: models.modelId,
        modelName: models.modelName,
        applicableType: models.applicableType,
        inputVars: models.inputVars,
        formulaLogic: models.formulaLogic,
        constants: models.constants,
        status: models.status,
      })
      .from(models)
      .where(eq(models.status, 'published'));

    // 2. 瀑布流寻价（AI参数按需懒提取，仅合同匹配失败时才调用AI）
    let successCount = 0;
    let jiaGongCount = 0;
    let pendingCount = 0;
    const rowResults: RowResult[] = new Array(rows.length);
    const pendingInserts: Array<typeof pendingItems.$inferInsert> = [];
    const BATCH_SIZE = 15;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length));
      const results = await Promise.all(
        batch.map((row) => this.processRow(taskId, row, taskLineType, publishedModels, this.aiParamsCache, estimateMode, targetProjects, domain)),
      );
      for (let j = 0; j < results.length; j++) {
        rowResults[i + j] = results[j].rowResult;
        if (results[j].rowResult.status === 'success') successCount++;
        else if (results[j].rowResult.status === 'jia_gong') jiaGongCount++;
        else {
          pendingCount++;
          if (results[j].pendingInsert) pendingInserts.push(results[j].pendingInsert);
        }
      }
      await this.db
        .update(estimateTasks)
        .set({
          totalRows: rows.length,
          successRows: successCount,
          jiaGongRows: jiaGongCount,
          pendingRows: pendingCount,
        })
        .where(eq(estimateTasks.id, taskId));
    }

    // 3. 批量插入 pending 项
    if (pendingInserts.length > 0) {
      await this.db.insert(pendingItems).values(pendingInserts);
    }

    // 4. 更新统计字段与状态
    await this.db
      .update(estimateTasks)
      .set({
        status: 'success',
        totalRows: rows.length,
        successRows: successCount,
        jiaGongRows: jiaGongCount,
        pendingRows: pendingCount,
      })
      .where(eq(estimateTasks.id, taskId));

    // 5. 存储完整结果供导出使用
    await this.db
      .update(estimateTasks)
      .set({ rowResults: sql`${JSON.stringify(rowResults)}::jsonb` })
      .where(eq(estimateTasks.id, taskId));
    this.aiParamsCache.clear();

    // 6. 异步执行异常检测（不阻塞主流程）
    this.runAnomalyDetection(taskId, rowResults).catch((err) => {
      this.logger.warn('异常检测失败，已忽略', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    });
  }

  private async processRow(
    taskId: string,
    row: CreateEstimateTaskRequest['rows'][number],
    taskLineType: LineType,
    cachedModels: PublishedModel[],
    aiCache: Map<string, Record<string, string | number>>,
    estimateMode: EstimateMode = 'standard',
    targetProjects: string[] = [],
    domain: ArchiveDomain = 'welding',
  ): Promise<{ rowResult: RowResult; pendingInsert?: typeof pendingItems.$inferInsert }> {
    const base = {
      device_name: row.device_name,
      line_type: row.line_type,
      quantity: row.quantity,
      unit: row.unit,
      usage_scope: row.usage_scope,
      supply_type: row.supply_type,
      modify_level: row.modify_level,
      copy_mode: row.copy_mode,
      workstation_no: row.workstation_no,
      workstation_desc: row.workstation_desc,
      brand: row.brand,
      category: row.category,
      distinction: row.distinction,
      spec_remark: row.spec_remark,
    };

    // a. 甲供 → price=0, status=jia_gong
    if (row.supply_type === '甲供') {
      return {
        rowResult: {
          ...base,
          status: 'jia_gong',
          price: 0,
          total_price: 0,
          source: '甲供',
          match_level: '甲供',
          remark: '甲供物料，无需采购定价',
        },
      };
    }

    // b. 瀑布流寻价：焊装按产线维度（同线→跨线降级→通用跨线参考），总装/涂装/冲压不区分产线
    const modeLabel = estimateMode === 'budget' ? '预算' : estimateMode === 'project_match' ? '指定项目' : '';

    if (domain !== 'welding') {
      const match = await this.findContractMatch(
        row.device_name,
        '',
        row.modify_level,
        estimateMode,
        targetProjects,
        domain,
        true,
      );
      if (match) {
        return {
          rowResult: {
            ...base,
            status: 'success',
            price: match.avgPrice,
            total_price: match.avgPrice * row.quantity,
            source: `历史合同(${match.projects})`,
            match_level: modeLabel ? `${modeLabel}匹配-精确` : '精确匹配',
            remark: `区分:${row.distinction || row.modify_level} 品牌:${match.brands || '-'}`,
          },
        };
      }
    } else {
      // Step 1: 优先在同产线查找（device_name + line_type + modify_level）
      const sameLineMatch = await this.findContractMatch(
        row.device_name,
        row.line_type,
        row.modify_level,
        estimateMode,
        targetProjects,
        domain,
      );

      if (sameLineMatch) {
        return {
          rowResult: {
            ...base,
            status: 'success',
            price: sameLineMatch.avgPrice,
            total_price: sameLineMatch.avgPrice * row.quantity,
            source: `历史合同(${sameLineMatch.projects})`,
            match_level: modeLabel ? `${modeLabel}匹配-同线` : '精确匹配-同线',
            remark: `线别:${row.line_type} 区分:${row.distinction || row.modify_level} 品牌:${sameLineMatch.brands || '-'}`,
          },
        };
      }

      // Step 2: 跨线降级查找（通用设备可参考其他线，专用设备仅参考）
      // 任务指定的产线优先，如果行数据中的线别未匹配，尝试任务产线
      if (row.line_type !== taskLineType) {
        const taskLineMatch = await this.findContractMatch(
          row.device_name,
          taskLineType,
          row.modify_level,
          estimateMode,
          targetProjects,
          domain,
        );

        if (taskLineMatch) {
          const isCrossLine = row.line_type !== taskLineType;
          return {
            rowResult: {
              ...base,
              status: 'success',
              price: taskLineMatch.avgPrice,
              total_price: taskLineMatch.avgPrice * row.quantity,
              source: `历史合同(${taskLineMatch.projects})`,
              match_level: modeLabel
                ? `${modeLabel}匹配-跨线降级`
                : isCrossLine ? '跨线降级-任务线' : '精确匹配',
              remark: `线别:${taskLineType}(跨线) 区分:${row.distinction || row.modify_level} 品牌:${taskLineMatch.brands || '-'}`,
            },
          };
        }
      }

      // Step 3: 通用设备查其他所有线（仅作为参考，不自动采用）
      if (row.usage_scope === '通用') {
        const crossLineMatch = await this.findBestCrossLineMatch(
          row.device_name,
          row.modify_level,
          row.line_type,
          estimateMode,
          targetProjects,
          domain,
        );

        if (crossLineMatch) {
          return {
            rowResult: {
              ...base,
              status: 'success',
              price: crossLineMatch.avgPrice,
              total_price: crossLineMatch.avgPrice * row.quantity,
              source: `历史合同(${crossLineMatch.projects})`,
              match_level: modeLabel ? `${modeLabel}匹配-跨线参考` : '跨线参考-通用设备',
              remark: `线别:${crossLineMatch.lineType}(跨线参考) 区分:${row.distinction || row.modify_level} 品牌:${crossLineMatch.brands || '-'}`,
            },
          };
        }
      }
    }

    // c. 改造设备测算：查找新增基价 + 改造系数 + AI参数组合
    const extractText = row.spec_remark
      ? `${row.device_name} ${row.spec_remark}`
      : row.device_name;
    const preExtracted = aiCache.get(extractText) ?? {};

    if (/改造/.test(row.modify_level)) {
      const retrofitResult = await this.tryRetrofitCalculation(row, cachedModels, preExtracted);
      if (retrofitResult) {
        return {
          rowResult: {
            ...base,
            status: 'success',
            price: retrofitResult.price,
            total_price: retrofitResult.price * row.quantity,
            source: retrofitResult.source,
            match_level: retrofitResult.match_level,
            remark: retrofitResult.remark,
          },
        };
      }
    }

    // d. 模型自动测算：查找已发布模型，AI提取参数，执行公式
    const modelResult = await this.tryModelCalculation(row, preExtracted, cachedModels);
    if (modelResult) {
      return {
        rowResult: {
          ...base,
          status: 'success',
          price: modelResult.price,
          total_price: modelResult.price * row.quantity,
          source: `模型测算(${modelResult.modelName})`,
          match_level: '模型公式计算',
          remark: modelResult.remark,
        },
      };
    }

    // e. 无匹配且无模型 → 创建 pending_item 记录
    const groupType = this.classifyGroupType(row);
    const matchedModel = this.findBestModel(row.device_name, cachedModels);

    let pendingInsert: typeof pendingItems.$inferInsert | undefined;
    if (matchedModel && matchedModel.formulaLogic) {
      const inputVars = (matchedModel.inputVars ?? []) as Array<{
        name: string; type: string; required: boolean; defaultValue?: string | number;
      }>;
       pendingInsert = {
         taskId,
         groupType: 'model_param',
         modelId: matchedModel.modelId,
         deviceName: row.device_name,
         params: inputVars.map((v) => ({
           name: v.name,
           type: v.type,
           required: v.required,
           value: v.defaultValue ?? '',
         })),
         filledValues: {
           _line_type: row.line_type,
           _modify_level: row.modify_level,
           _quantity: row.quantity,
         },
         specRemark: row.spec_remark || undefined,
         status: 'pending',
       };
    } else {
       pendingInsert = {
         taskId,
         groupType,
         deviceName: row.device_name,
         params: [
           { name: 'line_type', type: 'string', required: true, value: row.line_type },
           { name: 'modify_level', type: 'string', required: true, value: row.modify_level },
           { name: 'usage_scope', type: 'string', required: true, value: row.usage_scope },
           { name: 'copy_mode', type: 'string', required: true, value: row.copy_mode },
           { name: 'unit', type: 'string', required: true, value: row.unit },
         ],
         filledValues: {
           _line_type: row.line_type,
           _modify_level: row.modify_level,
           _quantity: row.quantity,
         },
         specRemark: row.spec_remark || undefined,
         status: 'pending',
       };
    }

    return {
      rowResult: {
        ...base,
        status: 'pending',
        price: 0,
        total_price: 0,
        source: '待人工处理',
        match_level: '无匹配',
        remark: '未找到匹配合同，需人工建模或参数填报',
        group_type: groupType,
      },
      pendingInsert,
    };
  }

  private selectByMode(
    rows: Array<{ id: string; unitPrice: string | null; project: string | null; lineType: string | null; archiveTime: Date | null; selectedBrand: string | null }>,
    estimateMode: EstimateMode,
  ): ContractMatchResult | null {
    const valid = rows.filter((r) => r.unitPrice !== null);
    if (valid.length === 0) return null;

    if (estimateMode === 'budget' || estimateMode === 'project_match') {
      const prices = valid.map((r) => parseFloat(String(r.unitPrice)) || 0);
      const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
      const projectNames = valid
        .map((r) => r.project || '-')
        .filter((v, i, arr) => arr.indexOf(v) === i);
      const label = estimateMode === 'budget' ? '高价均价' : '均价';
      const projects = projectNames.length > 1
        ? `${projectNames.join('、')}${label}`
        : projectNames[0];
      const brandNames = valid
        .map((r) => r.selectedBrand || '')
        .filter((v, i, arr) => v && arr.indexOf(v) === i);
      const brands = brandNames.join('、');
      return { id: valid[0].id, avgPrice, projects, brands, lineType: valid[0].lineType ?? '' };
    }

    // standard 模式：按项目分组取最低价，取最近2个项目均价
    const projectMap = new Map<string, { minPrice: number; latestTime: number; brand: string }>();
    for (const r of valid) {
      const proj = r.project || '-';
      const price = parseFloat(String(r.unitPrice)) || 0;
      const archTime = r.archiveTime ? new Date(r.archiveTime).getTime() : 0;
      const brand = r.selectedBrand || '';
      const existing = projectMap.get(proj);
      if (!existing) {
        projectMap.set(proj, { minPrice: price, latestTime: archTime, brand });
      } else {
        if (price < existing.minPrice) {
          existing.minPrice = price;
          existing.brand = brand;
        }
        existing.latestTime = Math.max(existing.latestTime, archTime);
      }
    }
    const sorted = Array.from(projectMap.entries())
      .sort((a, b) => b[1].latestTime - a[1].latestTime)
      .slice(0, 2);
    if (sorted.length === 0) return null;
    const prices = sorted.map(([, v]) => v.minPrice);
    const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
    const projectNames = sorted.map(([name]) => name);
    const projects = projectNames.length > 1
      ? `${projectNames.join('、')}低价均价`
      : `${projectNames[0]}低价`;
    const brandNames = sorted
      .map(([, v]) => v.brand)
      .filter((v, i, arr) => v && arr.indexOf(v) === i);
    const brands = brandNames.join('、');
    return { id: valid[0].id, avgPrice, projects, brands, lineType: valid[0].lineType ?? '' };
  }

  async getContractProjects(domain: ArchiveDomain = 'welding'): Promise<ContractProjectsResponse> {
    const t = this.tableFor(domain);
    const rows = await this.db
      .select({ project: t.project })
      .from(t)
      .where(eq(t.status, 'approved'));
    const projectSet = new Set<string>();
    for (const r of rows) {
      const p = (r.project ?? '').trim();
      if (p) projectSet.add(p);
    }
    const projects = Array.from(projectSet).sort((a: string, b: string) => a.localeCompare(b, 'zh-CN'));
    return { projects };
  }

  private async findContractMatch(
    deviceName: string,
    lineType: string,
    modifyLevel: string,
    estimateMode: EstimateMode = 'standard',
    targetProjects: string[] = [],
    domain: ArchiveDomain = 'welding',
    ignoreLineType = false,
  ): Promise<ContractMatchResult | null> {
    const t = this.tableFor(domain);
    const matchConditions = [
      eq(t.deviceMaterialName, deviceName),
      eq(t.distinction, modifyLevel),
      eq(t.status, 'approved'),
    ];
    if (!ignoreLineType) {
      matchConditions.push(eq(t.lineType, lineType));
    }
    if (estimateMode === 'project_match' && targetProjects.length > 0) {
      matchConditions.push(inArray(t.project, targetProjects));
    }

    const orderBy = estimateMode === 'budget'
      ? desc(t.unitPrice)
      : desc(t.archiveTime);
    const limit = (estimateMode === 'budget' || estimateMode === 'project_match') ? 100 : 100;

    const matched = await this.db
      .select({
        id: t.id,
        unitPrice: t.unitPrice,
        project: t.project,
        lineType: t.lineType,
        archiveTime: t.archiveTime,
        selectedBrand: t.selectedBrand,
      })
      .from(t)
      .where(and(...matchConditions))
      .orderBy(orderBy)
      .limit(limit);

    const result = this.selectByMode(matched, estimateMode);
    if (result) return result;

    // 精确匹配失败，尝试模糊匹配（处理隐藏空格、换行等情况）
    const fuzzyConditions = [
      like(t.deviceMaterialName, `%${deviceName}%`),
      eq(t.distinction, modifyLevel),
      eq(t.status, 'approved'),
    ];
    if (!ignoreLineType) {
      fuzzyConditions.push(eq(t.lineType, lineType));
    }
    if (estimateMode === 'project_match' && targetProjects.length > 0) {
      fuzzyConditions.push(inArray(t.project, targetProjects));
    }

    const fuzzyMatched = await this.db
      .select({
        id: t.id,
        unitPrice: t.unitPrice,
        project: t.project,
        lineType: t.lineType,
        archiveTime: t.archiveTime,
        selectedBrand: t.selectedBrand,
      })
      .from(t)
      .where(and(...fuzzyConditions))
      .orderBy(orderBy)
      .limit(limit);

    return this.selectByMode(fuzzyMatched, estimateMode);
  }

  private async findBestCrossLineMatch(
    deviceName: string,
    modifyLevel: string,
    excludeLineType: string,
    estimateMode: EstimateMode = 'standard',
    targetProjects: string[] = [],
    domain: ArchiveDomain = 'welding',
  ): Promise<ContractMatchResult | null> {
    const t = this.tableFor(domain);
    const conditions = [
      eq(t.deviceMaterialName, deviceName),
      eq(t.distinction, modifyLevel),
      eq(t.status, 'approved'),
    ];
    if (excludeLineType) {
      conditions.push(ne(t.lineType, excludeLineType));
    }
    if (estimateMode === 'project_match' && targetProjects.length > 0) {
      conditions.push(inArray(t.project, targetProjects));
    }

    const orderBy = estimateMode === 'budget'
      ? desc(t.unitPrice)
      : desc(t.archiveTime);
    const limit = (estimateMode === 'budget' || estimateMode === 'project_match') ? 100 : 100;

    const matched = await this.db
      .select({
        id: t.id,
        unitPrice: t.unitPrice,
        project: t.project,
        lineType: t.lineType,
        archiveTime: t.archiveTime,
        selectedBrand: t.selectedBrand,
      })
      .from(t)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit);

    const result = this.selectByMode(matched, estimateMode);
    if (result) return result;

    // 精确匹配失败，尝试模糊匹配
    const fuzzyConditions = [
      like(t.deviceMaterialName, `%${deviceName}%`),
      eq(t.distinction, modifyLevel),
      eq(t.status, 'approved'),
    ];
    if (excludeLineType) {
      fuzzyConditions.push(ne(t.lineType, excludeLineType));
    }

    const fuzzyMatched = await this.db
      .select({
        id: t.id,
        unitPrice: t.unitPrice,
        project: t.project,
        lineType: t.lineType,
        archiveTime: t.archiveTime,
        selectedBrand: t.selectedBrand,
      })
      .from(t)
      .where(and(...fuzzyConditions))
      .orderBy(orderBy)
      .limit(limit);

    return this.selectByMode(fuzzyMatched, estimateMode);
  }

  private classifyGroupType(
    row: CreateEstimateTaskRequest['rows'][number],
  ): PendingGroupType {
    const deviceType = row.device_type || '';
    // 按设备类型粗分：含"模型"/"模"字 → model_param；含"改造"/"改"字 → retrofit_param；其余 → no_data
    if (/模/.test(deviceType)) {
      return 'model_param';
    }
    if (/改/.test(deviceType)) {
      return 'retrofit_param';
    }
    return 'no_data';
  }

  /** 插件输出字段名 → 模型输入变量名映射（含中文别名） */
  private static readonly PARAM_ALIASES: Record<string, string[]> = {
    weight: ['weight', '重量', '设备重量', 'weight_kg'],
    power: ['power', '功率', '设备功率', 'power_kw'],
    voltage: ['voltage', '电压', '工作电压', 'voltage_v'],
    current: ['current', '电流', '工作电流', 'current_a'],
    pressure: ['pressure', '压力', '工作压力'],
    frequency: ['frequency', '频率', '工作频率'],
    size: ['size', '尺寸', '设备尺寸', '规格尺寸'],
    material: ['material', '材质', '设备材质'],
    brand: ['brand', '品牌', '设备品牌'],
    model_spec: ['model_spec', '型号', '设备型号', '规格型号'],
    welding_type: ['welding_type', '焊接类型', '焊接方式'],
    workpiece_thickness: ['workpiece_thickness', '工件厚度', '板厚'],
    electrode_diameter: ['electrode_diameter', '电极直径'],
    cycle_time: ['cycle_time', '节拍', '工作节拍'],
    quantity: ['quantity', '数量', '设备数量'],
  };

  /** 改造等级系数（占新增设备价格的比例） */
  private static readonly RETROFIT_COEFFICIENTS: Record<string, number> = {
    '改造-微': 0.10,
    '改造-小': 0.20,
    '改造-中': 0.35,
    '改造-大': 0.50,
  };

  private aiSemaphore = { count: 0, max: 3, queue: Array<() => void>() };
  private aiInFlight = new Map<string, Promise<Record<string, string | number>>>();

  private async acquireAiSlot(): Promise<void> {
    if (this.aiSemaphore.count < this.aiSemaphore.max) {
      this.aiSemaphore.count++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.aiSemaphore.queue.push(resolve);
    });
  }

  private releaseAiSlot(): void {
    const next = this.aiSemaphore.queue.shift();
    if (next) {
      next();
    } else {
      this.aiSemaphore.count = Math.max(0, this.aiSemaphore.count - 1);
    }
  }

  /** AI参数提取（带超时保护、内存缓存、并发限流、重试） */
  private async extractAiParams(
    text: string,
    timeoutMs = 30000,
  ): Promise<Record<string, string | number>> {
    const cached = this.aiParamsCache.get(text);
    if (cached) return cached;

    const inFlight = this.aiInFlight.get(text);
    if (inFlight) return inFlight;

    const promise = this.doExtractAiParams(text, timeoutMs);
    this.aiInFlight.set(text, promise);
    try {
      return await promise;
    } finally {
      this.aiInFlight.delete(text);
    }
  }

  private async doExtractAiParams(
    text: string,
    timeoutMs: number,
  ): Promise<Record<string, string | number>> {
    const cached = this.aiParamsCache.get(text);
    if (cached) return cached;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.acquireAiSlot();
        try {
          const output = await this.aiGateway.textToJson<
            { equipment_text: string },
            WeldingEquipmentParamExtractOneOutput
          >({
            taskKey: 'welding_equipment_param_extract',
            variables: { equipment_text: text },
          });
          const params: Record<string, string | number> = {};
          for (const [field, aliases] of Object.entries(EstimateTaskService.PARAM_ALIASES)) {
            const value = (output as unknown as Record<string, unknown>)[field];
            if (value !== undefined && value !== null && value !== '' && value !== 0) {
              for (const alias of aliases) {
                params[alias] = typeof value === 'number' ? value : String(value);
              }
            }
          }
          this.aiParamsCache.set(text, params);
          return params;
        } finally {
          this.releaseAiSlot();
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('频繁') || errMsg.includes('rate_limit') || errMsg.includes('RateLimit')) {
          const delay = 3000 * (attempt + 1);
          this.logger.warn(`AI限流，${delay}ms后重试 (${attempt + 1}/${maxRetries})`, { text });
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        this.logger.warn('AI参数提取失败', { text, error: errMsg });
        break;
      }
    }
    this.aiParamsCache.set(text, {});
    return {};
  }

  private findBestModel(
    deviceName: string,
    modelList: PublishedModel[],
  ): PublishedModel | null {
    const matched = modelList
      .filter((m) => {
        const at = (m.applicableType ?? '').trim();
        if (!at || at.length < 2) return false;
        return deviceName.includes(at) || at.includes(deviceName);
      })
      .sort((a, b) => {
        const lenA = (a.applicableType ?? '').trim().length;
        const lenB = (b.applicableType ?? '').trim().length;
        return lenB - lenA;
      });
    return matched[0] ?? null;
  }

  async updateRowResult(
    taskId: string,
    deviceName: string,
    modifyLevel: string,
    updates: Partial<RowResult>,
  ): Promise<void> {
    const results = await this.loadRowResults(taskId);
    if (!results.length) return;
    for (let i = 0; i < results.length; i++) {
      if (results[i].device_name === deviceName &&
          results[i].modify_level === modifyLevel &&
          results[i].status === 'pending') {
        results[i] = { ...results[i], ...updates };
        break;
      }
    }
    await this.db
      .update(estimateTasks)
      .set({ rowResults: sql`${JSON.stringify(results)}::jsonb` })
      .where(eq(estimateTasks.id, taskId));
  }

  private async tryModelCalculation(
    row: CreateEstimateTaskRequest['rows'][number],
    preExtractedParams?: Record<string, string | number>,
    cachedModels?: PublishedModel[],
  ): Promise<{ price: number; modelName: string; remark: string } | null> {
    const deviceName = row.device_name;

    // 1. 使用缓存的已发布模型（或查询）
    const modelRows: PublishedModel[] = cachedModels ?? await this.db
      .select({
        id: models.id,
        modelId: models.modelId,
        modelName: models.modelName,
        applicableType: models.applicableType,
        inputVars: models.inputVars,
        formulaLogic: models.formulaLogic,
        constants: models.constants,
        status: models.status,
      })
      .from(models)
      .where(eq(models.status, 'published'));

    if (modelRows.length === 0) return null;

    const matchedModel = this.findBestModel(deviceName, modelRows);
    if (!matchedModel || !matchedModel.formulaLogic) return null;

    this.logger.log(
      `tryModelCalculation: device=${deviceName}, model=${matchedModel.modelName}`,
    );

    // 2. AI 提取设备参数（优先使用预提取参数）
    let extractedParams: Record<string, string | number> = {};
    if (preExtractedParams && Object.keys(preExtractedParams).length > 0) {
      extractedParams = preExtractedParams;
    } else {
      const extractText = row.spec_remark
        ? `${deviceName} ${row.spec_remark}`
        : deviceName;
      extractedParams = await this.extractAiParams(extractText);
    }

    // 3. 构造公式入参：常量 + AI提取值 + 默认值
    const constants = (matchedModel.constants ?? {}) as Record<string, string | number>;
    const inputVars = (matchedModel.inputVars ?? []) as Array<{
      name: string;
      type: string;
      required: boolean;
      defaultValue?: string | number;
    }>;

    const formulaParams: Record<string, string | number> = { ...constants };
    const missingRequired: string[] = [];

    for (const v of inputVars) {
      if (extractedParams[v.name] !== undefined) {
        formulaParams[v.name] = extractedParams[v.name];
      } else if (v.defaultValue !== undefined && v.defaultValue !== null && v.defaultValue !== '') {
        formulaParams[v.name] = v.defaultValue;
      } else if (v.required) {
        missingRequired.push(v.name);
      }
    }

    if (missingRequired.length > 0) {
      this.logger.warn('必填参数缺失，跳过模型测算', {
        device: deviceName,
        missing: missingRequired.join(', '),
      });
      return null;
    }

    // 4. 执行公式
    const result = this.modelService.evaluateFormula(
      matchedModel.formulaLogic,
      formulaParams,
      constants,
    );

    if (!result.success || !result.result || result.result <= 0) {
      this.logger.warn('公式计算失败', {
        device: deviceName,
        error: result.error,
      });
      return null;
    }

    const paramSummary = inputVars
      .map((v) => `${v.name}=${formulaParams[v.name] ?? '-'}`)
      .join(', ');

    return {
      price: result.result,
      modelName: matchedModel.modelName,
      remark: `模型:${matchedModel.modelName} 参数:${paramSummary}`,
    };
  }

  private async tryRetrofitCalculation(
    row: CreateEstimateTaskRequest['rows'][number],
    cachedModels: PublishedModel[],
    preExtractedParams?: Record<string, string | number>,
  ): Promise<{ price: number; source: string; match_level: string; remark: string } | null> {
    const modifyLevel = row.modify_level;
    const coefficient = EstimateTaskService.RETROFIT_COEFFICIENTS[modifyLevel];
    if (!coefficient) return null;

    this.logger.log(
      `tryRetrofitCalculation: device=${row.device_name}, modifyLevel=${modifyLevel}`,
    );

    // 1. 查找同设备「新增」版本作为基价
    const baseMatch = await this.findContractMatch(
      row.device_name,
      row.line_type,
      '新增',
    );

    let basePrice = 0;
    let baseSource = '';

    if (baseMatch) {
      basePrice = baseMatch.avgPrice;
      baseSource = `历史合同(${baseMatch.projects})`;
    }

    // 1b. 通用设备跨线查找新增基价
    if (basePrice === 0 && row.usage_scope === '通用') {
      const crossBaseMatch = await this.findBestCrossLineMatch(
        row.device_name,
        '新增',
        row.line_type,
      );
      if (crossBaseMatch) {
        basePrice = crossBaseMatch.avgPrice;
        baseSource = `历史合同(${crossBaseMatch.projects})-跨线`;
      }
    }

    // 无基价 → 转入模型公式测算
    if (basePrice === 0) {
      this.logger.log('tryRetrofitCalculation: 无新增基价，转入模型测算', {
        device: row.device_name,
      });
      return null;
    }

    // 2. AI提取参数（优先使用预提取参数）
    let aiParams: Record<string, string | number> = {};
    if (preExtractedParams && Object.keys(preExtractedParams).length > 0) {
      aiParams = preExtractedParams;
    } else {
      const extractText = row.spec_remark
        ? `${row.device_name} ${row.spec_remark}`
        : row.device_name;
      aiParams = await this.extractAiParams(extractText);
    }

    // 3. 尝试模型公式精算（使用AI提取的参数）
    let modelPrice = 0;
    let modelName = '';
    if (Object.keys(aiParams).length > 0) {
      const modelResult = await this.tryModelCalculation(row, aiParams, cachedModels);
      if (modelResult) {
        modelPrice = modelResult.price;
        modelName = modelResult.modelName;
      }
    }

    // 4. 计算最终价格：优先使用模型精算基价，否则用历史基价
    const finalBasePrice = modelPrice > 0 ? modelPrice : basePrice;
    const finalPrice = Math.round(finalBasePrice * coefficient * 100) / 100;

    // 5. 构建备注
    const remarkParts: string[] = [
      `改造基价:${finalBasePrice}`,
      `系数:${modifyLevel}=${(coefficient * 100).toFixed(0)}%`,
    ];
    if (modelPrice > 0) {
      remarkParts.push(`模型(${modelName})精算基价:${modelPrice}`);
    } else {
      remarkParts.push(`历史基价:${basePrice}`);
    }
    if (row.spec_remark) {
      remarkParts.push(`规格备注:${row.spec_remark}`);
    }

    return {
      price: finalPrice,
      source: modelPrice > 0
        ? `改造测算(模型+系数) ${baseSource}`
        : `改造测算(基价+系数) ${baseSource}`,
      match_level: modelPrice > 0 ? '改造-模型+系数组合' : '改造-基价系数',
      remark: remarkParts.join(' | '),
    };
  }

  async getTask(id: string): Promise<EstimateTask | null> {
    this.logger.log(`getTask: id=${id}`);
    const rows = await this.db
      .select({
        id: estimateTasks.id,
        file_name: estimateTasks.fileName,
        status: estimateTasks.status,
        total_rows: estimateTasks.totalRows,
        success_rows: estimateTasks.successRows,
        jia_gong_rows: estimateTasks.jiaGongRows,
        pending_rows: estimateTasks.pendingRows,
        main_result_url: estimateTasks.mainResultUrl,
        unknown_result_url: estimateTasks.unknownResultUrl,
        domain: estimateTasks.domain,
        created_at: estimateTasks.createdAt,
      })
      .from(estimateTasks)
      .where(eq(estimateTasks.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const r = rows[0];
    let anomalyResult: AnomalyDetectionResult | undefined;
    if (r.main_result_url) {
      try {
        const parsed = JSON.parse(r.main_result_url);
        if (parsed && parsed.risk_level) {
          anomalyResult = parsed as AnomalyDetectionResult;
        }
      } catch {
        // main_result_url 不是 JSON，保持原样
      }
    }
    return {
      id: r.id,
      file_name: r.file_name,
      status: r.status as EstimateTask['status'],
      domain: (r.domain as ArchiveDomain) ?? 'welding',
      total_rows: r.total_rows ?? 0,
      success_rows: r.success_rows ?? 0,
      jia_gong_rows: r.jia_gong_rows ?? 0,
      pending_rows: r.pending_rows ?? 0,
      main_result_url: anomalyResult ? undefined : (r.main_result_url ?? undefined),
      unknown_result_url: r.unknown_result_url ?? undefined,
      anomaly_result: anomalyResult,
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
    };
  }

  async getTaskItems(
    id: string,
    page: number,
    pageSize: number,
    filter: string,
  ): Promise<EstimateTaskItemListResponse> {
    this.logger.log(
      `getTaskItems: id=${id}, page=${page}, pageSize=${pageSize}, filter=${filter}`,
    );

    const allResults = await this.loadRowResults(id);

    let filtered: RowResult[];
    if (filter === 'all') {
      filtered = allResults;
    } else if (filter === 'success') {
      filtered = allResults.filter((r) => r.status === 'success');
    } else if (filter === 'jia_gong') {
      filtered = allResults.filter((r) => r.status === 'jia_gong');
    } else {
      filtered = allResults.filter((r) => r.status === 'pending');
    }

    const total = filtered.length;
    const offset = Math.max(0, (page - 1) * pageSize);
    const paged = filtered.slice(offset, offset + pageSize);

    const mappedItems: EstimateTaskItem[] = paged.map((r, idx) => ({
      id: `${id}_${offset + idx}`,
      device_name: r.device_name,
      line_type: r.line_type as EstimateTaskItem['line_type'],
      quantity: r.quantity,
      unit: r.unit,
      usage_scope: r.usage_scope as EstimateTaskItem['usage_scope'],
      supply_type: r.supply_type as EstimateTaskItem['supply_type'],
      price: r.price,
      total_price: r.total_price,
      source: r.source,
      match_level: r.match_level,
      remark: r.remark,
      status: r.status,
      workstation_no: r.workstation_no,
      workstation_desc: r.workstation_desc,
      brand: r.brand,
      category: r.category,
      distinction: r.distinction,
      copy_mode: r.copy_mode as EstimateTaskItem['copy_mode'],
      spec_remark: r.spec_remark,
    }));

    return { items: mappedItems, total };
  }

  async downloadResult(id: string, type: string): Promise<{ url: string; filename: string }> {
    this.logger.log(`downloadResult: id=${id}, type=${type}`);
    const results = await this.loadRowResults(id);
    if (results.length === 0) {
      return { url: '', filename: '' };
    }

    const XLSX = require('xlsx');
    const filtered = type === 'anomaly'
      ? results.filter((r) => r.status === 'success' && r.price > 0)
      : type === 'pending'
        ? results.filter((r) => r.status === 'pending')
        : results;

    const headerMap: Record<string, string> = {
      device_name: '设备/材料名称', line_type: '线别', quantity: '数量', unit: '单位',
      usage_scope: '使用范围', supply_type: '供应方式', modify_level: '区分度',
      copy_mode: '复制模式', price: '单价', total_price: '合价',
      source: '来源', match_level: '匹配等级', remark: '备注',
      status: '状态', workstation_no: '工位号', workstation_desc: '工位描述',
      brand: '品牌', category: '类别', distinction: '区分', spec_remark: '规格备注',
    };

    const rows = filtered.map((r) => {
      const row: Record<string, string | number> = {};
      for (const [key, label] of Object.entries(headerMap)) {
        const val = (r as any)[key];
        if (val !== undefined && val !== null && val !== '') {
          row[label] = val;
        }
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '测算结果');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const taskRows = await this.db
      .select({ fileName: estimateTasks.fileName })
      .from(estimateTasks)
      .where(eq(estimateTasks.id, id))
      .limit(1);
    const baseName = taskRows[0]?.fileName?.replace(/\.\w+$/, '') || 'result';
    const fileName = `${baseName}-${type || 'all'}.xlsx`;

    const { filePath } = await this.fileService.upload(buf, { fileName, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = await this.fileService.createSignedUrl(filePath, 3600);
    return { url: url || '', filename: fileName };
  }

  private async runAnomalyDetection(
    taskId: string,
    rowResults: RowResult[],
  ): Promise<void> {
    this.logger.log(`runAnomalyDetection: taskId=${taskId}`);

    // 筛选成功匹配的行用于异常检测
    const successResults = rowResults.filter(
      (r) => r.status === 'success' && r.price > 0,
    );
    if (successResults.length === 0) {
      this.logger.log('无成功匹配项，跳过异常检测');
      return;
    }

    const comparisonText = successResults
      .map((r) => {
        return `设备:${r.device_name}, 线别:${r.line_type}, 测算单价:${r.price}, 总价:${r.total_price}, 来源:${r.source}, 匹配等级:${r.match_level}`;
      })
      .join('\n');

    try {
      const output = await this.aiGateway.textToJson<
        { comparison_text: string },
        WeldingCostAnomalyDetectionOneOutput
      >({
        taskKey: 'welding_cost_anomaly_detection',
        variables: { comparison_text: comparisonText },
      });

      const anomalyResult: AnomalyDetectionResult = {
        risk_level: output.risk_level as AnomalyDetectionResult['risk_level'],
        anomaly_count: Number(output.anomaly_count) || 0,
        anomaly_devices: String(output.anomaly_devices || ''),
        anomaly_levels: String(output.anomaly_levels || ''),
        overall_assessment: String(output.overall_assessment || ''),
        recommendation: String(output.recommendation || ''),
      };

      this.logger.log(`异常检测完成: risk=${anomalyResult.risk_level}, count=${anomalyResult.anomaly_count}`);

      // 存储到 main_result_url 字段（JSON 字符串，复用现有字段）
      await this.db
        .update(estimateTasks)
        .set({ mainResultUrl: JSON.stringify(anomalyResult) })
        .where(eq(estimateTasks.id, taskId));
    } catch (err) {
      this.logger.error('异常检测插件调用失败', {
        pluginInstanceId: 'welding_cost_anomaly_detection_1',
        actionKey: 'textToJson',
        outputMode: 'unary',
        inputKeys: ['comparison_text'],
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async getAnomalyResult(id: string): Promise<AnomalyDetectionResult | null> {
    try {
      const rows = await this.db
        .select({ mainResultUrl: estimateTasks.mainResultUrl })
        .from(estimateTasks)
        .where(eq(estimateTasks.id, id))
        .limit(1);

      if (rows.length === 0 || !rows[0].mainResultUrl) {
        return null;
      }

      return JSON.parse(rows[0].mainResultUrl) as AnomalyDetectionResult;
    } catch {
      return null;
    }
  }
}
