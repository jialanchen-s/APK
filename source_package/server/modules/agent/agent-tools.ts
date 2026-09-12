import { eq, and, desc, count, like, sql } from 'drizzle-orm';
import type { PostgresJsDatabase, CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import {
  contract,
  model as modelTable,
  pendingItem,
  agentSession,
} from '@server/database/schema';
import type { EstimateTaskService } from '@server/modules/estimate-task/estimate-task.service';
import type { ModelService } from '@server/modules/model/model.service';
import type { EstimateTaskRow } from '@shared/api.interface';
import type { WeldingEquipmentParamExtractOneOutput } from '@shared/plugin-types';

export interface ToolContext {
  db: PostgresJsDatabase;
  capabilityService: CapabilityService;
  estimateTaskService: EstimateTaskService;
  modelService: ModelService;
  userId: string;
  sessionId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export const AGENT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_contracts',
    description: '搜索历史合同价格记录。返回匹配的合同列表（设备名、线别、价格、项目编号、结算日期）。',
    parameters: {
      device_name: { type: 'string', description: '设备名称关键词', required: true },
      line_type: { type: 'string', description: '线别（主线/侧围线/开闭件线/下车体线）' },
      modify_level: { type: 'string', description: '改造等级' },
    },
  },
  {
    name: 'create_estimate_task',
    description: '创建测算任务并自动执行瀑布流寻价（同线匹配→跨线降级→模型自动测算）。返回任务ID和统计结果。',
    parameters: {
      file_name: { type: 'string', description: '文件名', required: true },
      line_type: { type: 'string', description: '产线类型', required: true },
      rows: { type: 'array', description: '设备数据行数组', required: true },
    },
  },
  {
    name: 'get_task_status',
    description: '查询测算任务的状态和统计（总数/成功/甲供/待处理）。',
    parameters: {
      task_id: { type: 'string', description: '任务ID', required: true },
    },
  },
  {
    name: 'get_task_items',
    description: '获取测算任务的结果明细（设备名、价格、来源、匹配等级）。',
    parameters: {
      task_id: { type: 'string', description: '任务ID', required: true },
      filter: { type: 'string', description: '筛选类型（all/success/pending/jia_gong）' },
    },
  },
  {
    name: 'find_published_models',
    description: '列出所有已发布的核算模型（模型名、适用类型、输入变量）。',
    parameters: {},
  },
  {
    name: 'extract_device_params',
    description: 'AI自动提取设备参数（重量、功率、电压等）。',
    parameters: {
      device_name: { type: 'string', description: '设备名称', required: true },
    },
  },
  {
    name: 'calculate_model_price',
    description: '使用模型公式计算设备价格。自动匹配模型、提取参数、执行公式。',
    parameters: {
      model_name: { type: 'string', description: '模型名称', required: true },
      device_name: { type: 'string', description: '设备名称', required: true },
    },
  },
  {
    name: 'get_pending_items',
    description: '获取测算任务中未匹配的待处理设备列表。',
    parameters: {
      task_id: { type: 'string', description: '任务ID', required: true },
    },
  },
  {
    name: 'detect_anomalies',
    description: '对已完成测算的任务执行异常检测，返回偏离历史均价的设备列表。',
    parameters: {
      task_id: { type: 'string', description: '任务ID', required: true },
    },
  },
];

export function buildToolDefinitionsPrompt(): string {
  const lines: string[] = ['## 可用工具', ''];
  for (const tool of AGENT_TOOL_DEFINITIONS) {
    const params = Object.entries(tool.parameters);
    const paramStr = params.length > 0
      ? params.map(([k, v]) => `${k}(${v.type}${v.required ? ',必填' : ''})`).join(', ')
      : '无参数';
    lines.push(`${tool.name}(${paramStr}) - ${tool.description}`);
  }
  return lines.join('\n');
}

export async function executeAgentTool(
  toolName: string,
  params: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (toolName) {
      case 'search_contracts':
        return await searchContracts(params, ctx);
      case 'create_estimate_task':
        return await createEstimateTask(params, ctx);
      case 'get_task_status':
        return await getTaskStatus(params, ctx);
      case 'get_task_items':
        return await getTaskItems(params, ctx);
      case 'find_published_models':
        return await findPublishedModels(ctx);
      case 'extract_device_params':
        return await extractDeviceParams(params, ctx);
      case 'calculate_model_price':
        return await calculateModelPrice(params, ctx);
      case 'get_pending_items':
        return await getPendingItems(params, ctx);
      case 'detect_anomalies':
        return await detectAnomalies(params, ctx);
      default:
        return { success: false, error: `未知工具: ${toolName}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

async function searchContracts(
  params: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const deviceName = String(params.device_name ?? '');
  const lineType = params.line_type ? String(params.line_type) : undefined;
  const modifyLevel = params.modify_level ? String(params.modify_level) : undefined;

  const conditions = [eq(contract.status, 'approved')];
  if (deviceName) conditions.push(like(contract.deviceMaterialName, `%${deviceName}%`));
  if (lineType) conditions.push(eq(contract.lineType, lineType));
  if (modifyLevel) conditions.push(eq(contract.distinction, modifyLevel));

  const rows = await ctx.db
    .select({
      id: contract.id,
      project: contract.project,
      line_type: contract.lineType,
      device_material_name: contract.deviceMaterialName,
      supply: contract.supply,
      unit_price: contract.unitPrice,
      settle_date: contract.settleDate,
    })
    .from(contract)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contract.settleDate))
    .limit(20);

  const items = rows.map((r) => ({
    device_name: r.device_material_name,
    line_type: r.line_type ?? '',
    price: parseFloat(r.unit_price ?? '0'),
    project_id: r.project ?? '',
    settle_date: r.settle_date instanceof Date ? r.settle_date.toISOString().slice(0, 10) : String(r.settle_date ?? ''),
  }));

  return { success: true, data: { count: items.length, items } };
}

async function createEstimateTask(
  params: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const fileName = String(params.file_name ?? 'Agent上传');
  const lineType = String(params.line_type ?? '主线');
  const rows = (params.rows as EstimateTaskRow[]) ?? [];

  if (rows.length === 0) {
    return { success: false, error: 'rows不能为空' };
  }

  const taskResult = await ctx.estimateTaskService.createTask(ctx.userId, {
    file_name: fileName,
    line_type: lineType as EstimateTaskRow['line_type'],
    rows,
  });

  await ctx.db
    .update(agentSession)
    .set({ taskId: taskResult.id, title: `焊装测算 - ${fileName}` })
    .where(eq(agentSession.id, ctx.sessionId));

  // 轮询等待任务完成（最多60秒）
  let task = await ctx.estimateTaskService.getTask(taskResult.id);
  const maxWaitMs = 60000;
  const start = Date.now();
  while (task && task.status === 'processing' && Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 3000));
    task = await ctx.estimateTaskService.getTask(taskResult.id);
  }

  return {
    success: true,
    data: {
      task_id: taskResult.id,
      status: task?.status ?? 'processing',
      total_rows: task?.total_rows ?? 0,
      success_rows: task?.success_rows ?? 0,
      jia_gong_rows: task?.jia_gong_rows ?? 0,
      pending_rows: task?.pending_rows ?? 0,
      message: `任务已创建，共${task?.total_rows ?? 0}条设备，成功匹配${task?.success_rows ?? 0}条，甲供${task?.jia_gong_rows ?? 0}条，待处理${task?.pending_rows ?? 0}条。`,
    },
  };
}

async function getTaskStatus(
  params: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const taskId = String(params.task_id ?? '');
  const task = await ctx.estimateTaskService.getTask(taskId);
  if (!task) return { success: false, error: '任务不存在' };

  return {
    success: true,
    data: {
      task_id: taskId,
      status: task.status,
      total_rows: task.total_rows,
      success_rows: task.success_rows,
      jia_gong_rows: task.jia_gong_rows,
      pending_rows: task.pending_rows,
    },
  };
}

async function getTaskItems(
  params: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const taskId = String(params.task_id ?? '');
  const filter = String(params.filter ?? 'all');
  const result = await ctx.estimateTaskService.getTaskItems(taskId, 1, 50, filter);

  return {
    success: true,
    data: {
      total: result.total,
      items: result.items.map((it) => ({
        device_name: it.device_name,
        price: it.price,
        total_price: it.total_price,
        source: it.source,
        match_level: it.match_level,
        status: it.status,
      })),
    },
  };
}

async function findPublishedModels(
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const rows = await ctx.db
    .select({
      model_id: modelTable.modelId,
      model_name: modelTable.modelName,
      applicable_type: modelTable.applicableType,
      input_vars: modelTable.inputVars,
      status: modelTable.status,
    })
    .from(modelTable)
    .where(eq(modelTable.status, 'published'));

  return {
    success: true,
    data: {
      count: rows.length,
      models: rows.map((r) => ({
        model_id: r.model_id,
        model_name: r.model_name,
        applicable_type: r.applicable_type ?? '',
        input_vars: r.input_vars ?? [],
      })),
    },
  };
}

async function extractDeviceParams(
  params: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const deviceName = String(params.device_name ?? '');

  const output = await ctx.capabilityService
    .load('welding_equipment_param_extract_1')
    .call('textToJson', { equipment_text: deviceName }) as WeldingEquipmentParamExtractOneOutput;

  return { success: true, data: output };
}

async function calculateModelPrice(
  params: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const modelName = String(params.model_name ?? '');
  const deviceName = String(params.device_name ?? '');

  const modelRows = await ctx.db
    .select({
      id: modelTable.id,
      model_id: modelTable.modelId,
      model_name: modelTable.modelName,
      applicable_type: modelTable.applicableType,
      input_vars: modelTable.inputVars,
      formula_logic: modelTable.formulaLogic,
      constants: modelTable.constants,
      status: modelTable.status,
    })
    .from(modelTable)
    .where(eq(modelTable.status, 'published'));

  const matched = modelRows.find(
    (m) => m.model_name === modelName || m.model_id === modelName,
  );

  if (!matched) {
    return { success: false, error: `未找到已发布模型: ${modelName}` };
  }

  if (!matched.formula_logic) {
    return { success: false, error: '模型公式为空' };
  }

  let extractedParams: Record<string, string | number> = {};
  try {
    const output = await ctx.capabilityService
      .load('welding_equipment_param_extract_1')
      .call('textToJson', { equipment_text: deviceName }) as WeldingEquipmentParamExtractOneOutput;

    const paramAliases: Record<string, string[]> = {
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
    };

    for (const [field, aliases] of Object.entries(paramAliases)) {
      const value = (output as unknown as Record<string, unknown>)[field];
      if (value !== undefined && value !== null && value !== '') {
        for (const alias of aliases) {
          extractedParams[alias] = typeof value === 'number' ? value : String(value);
        }
      }
    }
  } catch {
    // 使用默认值
  }

  const constants = (matched.constants ?? {}) as Record<string, string | number>;
  const inputVars = (matched.input_vars ?? []) as Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: string | number;
  }>;

  const formulaParams: Record<string, string | number> = { ...constants };
  for (const v of inputVars) {
    if (extractedParams[v.name] !== undefined) {
      formulaParams[v.name] = extractedParams[v.name];
    } else if (v.defaultValue !== undefined && v.defaultValue !== null && v.defaultValue !== '') {
      formulaParams[v.name] = v.defaultValue;
    } else if (v.required) {
      formulaParams[v.name] = v.type === 'number' ? 1 : '';
    }
  }

  const result = ctx.modelService.evaluateFormula(
    matched.formula_logic,
    formulaParams,
    constants,
  );

  if (!result.success || !result.result || result.result <= 0) {
    return { success: false, error: result.error ?? '公式计算结果无效' };
  }

  const paramSummary = inputVars
    .map((v) => `${v.name}=${formulaParams[v.name] ?? '-'}`)
    .join(', ');

  return {
    success: true,
    data: {
      model_name: matched.model_name,
      device_name: deviceName,
      price: result.result,
      params: paramSummary,
    },
  };
}

async function getPendingItems(
  params: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const taskId = String(params.task_id ?? '');

  const rows = await ctx.db
    .select({
      id: pendingItem.id,
      device_name: pendingItem.deviceName,
      group_type: pendingItem.groupType,
      status: pendingItem.status,
    })
    .from(pendingItem)
    .where(and(eq(pendingItem.taskId, taskId), eq(pendingItem.status, 'pending')))
    .limit(50);

  return {
    success: true,
    data: {
      count: rows.length,
      items: rows.map((r) => ({
        device_name: r.device_name,
        group_type: r.group_type,
        status: r.status,
      })),
    },
  };
}

async function detectAnomalies(
  params: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const taskId = String(params.task_id ?? '');

  const sessionRows = await ctx.db
    .select({ taskId: agentSession.taskId })
    .from(agentSession)
    .where(eq(agentSession.id, ctx.sessionId))
    .limit(1);

  const sessionTaskId = sessionRows[0]?.taskId ?? taskId;

  const taskItems = await ctx.estimateTaskService.getTaskItems(sessionTaskId, 1, 200, 'success');

  const anomalies: Array<Record<string, unknown>> = [];
  for (const item of taskItems.items) {
    if (item.price <= 0) continue;

    const historyRows = await ctx.db
      .select({ unitPrice: contract.unitPrice })
      .from(contract)
      .where(and(like(contract.deviceMaterialName, `%${item.device_name}%`), eq(contract.status, 'approved')))
      .limit(10);

    const prices = historyRows
      .map((r) => parseFloat(r.unitPrice ?? '0'))
      .filter((p) => p > 0);

    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const deviation = avgPrice > 0 ? ((item.price - avgPrice) / avgPrice) * 100 : 0;
      if (Math.abs(deviation) > 15) {
        anomalies.push({
          device_name: item.device_name,
          calculated_price: item.price,
          historical_avg: Math.round(avgPrice * 100) / 100,
          deviation: Math.round(deviation * 100) / 100,
          level: Math.abs(deviation) > 30 ? 'critical' : 'warning',
        });
      }
    }
  }

  return {
    success: true,
    data: {
      total_checked: taskItems.items.length,
      anomaly_count: anomalies.length,
      anomalies,
    },
  };
}
