import { Logger } from '@nestjs/common';
import type {
  JsonSchemaField,
  LLMAdapter,
  LLMChatParams,
  LLMChatResult,
  LLMStreamChunk,
  LLMTextToJsonParams,
  TextToJsonFn,
} from './llm-adapter.interface';
import { getTaskDefinition } from './task-registry';

const MOCK_RESPONSES: Record<string, () => Record<string, unknown>> = {
  welding_equipment_param_extract: () => ({
    frequency: 50,
    brand: 'Fronius',
    welding_type: 'MIG/MAG',
    workpiece_thickness: 2.5,
    cycle_time: 45,
    voltage: 380,
    current: 250,
    model_spec: 'TPS400i',
    quantity: 1,
    weight: 85,
    other_params: '',
    size: '600x400x800mm',
    material: 'Steel',
    electrode_diameter: 1.2,
    power: 15,
    pressure: 0,
  }),

  welding_equipment_param_extraction: () => ({
    value: '150',
  }),

  welding_cost_anomaly_detection: () => ({
    anomaly_levels: 'normal',
    overall_assessment: '本次测算结果与历史合同数据基本一致，整体偏离在合理范围内，未发现显著异常。',
    recommendation: '当前测算价格可信度高，可直接作为报价参考依据。',
    risk_level: 'low',
    anomaly_count: 0,
    anomaly_devices: '',
  }),

  welding_equipment_intelligent_matching: () => ({
    matched_model_id: 'model-welding-001',
    matched_model_name: '焊装设备基价测算模型',
    confidence: 85,
    match_reason: '设备名称与模型名称高度相关，设备类型匹配',
    alternative_model_id: '',
    alternative_model_name: '',
  }),

  contract_detail_extract: () => ({
    rowsJson: JSON.stringify([
      {
        project: 'Mock项目A',
        device_material_name: '点焊机',
        category: '焊装设备',
        distinction: '标准型',
        copy_mode: '复制',
        usage_scope: '通用',
        unit_price: 85000,
        price_caliber: '未税',
        unit: '台',
        quantity: 2,
        subtotal: 170000,
        supply: '采购',
        selected_brand: 'Fronius',
        settle_date: '2025-06-15',
        workstation_no: 'WS-001',
        workstation_desc: '焊装工位1',
        remark: '',
      },
    ]),
  }),

  manufacturing_contract_detail_extract: () => ({
    rowsJson: JSON.stringify([
      {
        project: 'Mock制造项目',
        device_material_name: '工业机器人',
        specification: '六轴 20kg负载',
        unit_price: 250000,
        price_caliber: '未税',
        unit: '台',
        quantity: 1,
        subtotal: 250000,
        selected_brand: 'FANUC',
        settle_date: '2025-08-01',
        remark: '含安装调试',
      },
    ]),
  }),
};

const CHAT_MOCK = `根据当前系统数据分析，本次焊装费用测算结果整体合理。

主要结论：
1. 设备价格与历史合同均价偏离在5%以内，属于正常波动范围
2. 建议直接采用测算结果作为报价参考
3. 如需进一步精确，可补充近期合同数据更新基线

注：当前为 Mock 模式，以上为模拟回复，待接入真实 LLM 后将提供精准分析。`;

export class MockLLMAdapter implements LLMAdapter {
  readonly name = 'mock';
  private readonly logger = new Logger(MockLLMAdapter.name);

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    this.logger.log(`[mock] chat called, messages=${params.messages.length}`);
    return { content: CHAT_MOCK, finishReason: 'stop' };
  }

  async *stream(params: LLMChatParams): AsyncIterable<LLMStreamChunk> {
    this.logger.log(`[mock] stream called`);
    const result = await this.chat(params);
    const words = result.content.split('');
    for (const char of words) {
      yield { delta: char, finishReason: 'stop' };
    }
  }

  async textToJson<TInput extends Record<string, string>, TOutput extends object>(
    params: LLMTextToJsonParams<TInput>,
  ): Promise<TOutput> {
    if (!params.taskKey) {
      throw new Error('MockLLMAdapter.textToJson requires params.taskKey');
    }

    const taskDef = getTaskDefinition(params.taskKey);
    const factory = MOCK_RESPONSES[params.taskKey];

    if (factory) {
      const data = factory();
      this.logger.log(`[mock] textToJson task=${params.taskKey} → ${Object.keys(data).length} fields`);
      return data as TOutput;
    }

    this.logger.warn(`[mock] no mock response for task=${params.taskKey}, returning empty fields`);
    const fallback: Record<string, unknown> = {};
    if (taskDef.jsonSchema) {
      for (const field of taskDef.jsonSchema) {
        fallback[field.name] = field.type === 'Number' ? 0 : '';
      }
    }
    return fallback as TOutput;
  }

  bindTask<TInput extends Record<string, string>, TOutput extends object>(
    taskKey: string,
  ): TextToJsonFn<TInput, TOutput> {
    getTaskDefinition(taskKey);
    return async (variables, options) =>
      this.textToJson<TInput, TOutput>({
        taskKey,
        variables,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        signal: options?.signal,
      });
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
