import { Logger } from '@nestjs/common';
import type { LocalCapabilityService } from '@server/common/capability/local-capability.service';
import type {
  JsonSchemaField,
  JsonValue,
  LLMAdapter,
  LLMChatParams,
  LLMChatResult,
  LLMStreamChunk,
  LLMTextToJsonParams,
  TextToJsonFn,
} from './llm-adapter.interface';
import { getTaskDefinition, renderPrompt } from './task-registry';
import { callCapabilityWithTimeout } from '../utils/plugin-call';

export interface ApaasPluginMapping {
  welding_equipment_param_extract?: string;
  welding_equipment_param_extraction?: string;
  welding_cost_anomaly_detection?: string;
  welding_cost_calculation_chat_assistant?: string;
  welding_equipment_intelligent_matching?: string;
  contract_detail_extract?: string;
  manufacturing_contract_detail_extract?: string;
}

export const DEFAULT_PLUGIN_IDS: Required<ApaasPluginMapping> = {
  welding_equipment_param_extract: 'welding_equipment_param_extract_1',
  welding_equipment_param_extraction: 'welding_equipment_param_extraction_1',
  welding_cost_anomaly_detection: 'welding_cost_anomaly_detection_1',
  welding_cost_calculation_chat_assistant: 'welding_cost_calculation_chat_assistant_1',
  welding_equipment_intelligent_matching: 'welding_equipment_intelligent_matching_1',
  contract_detail_extract: 'contract_detail_extract_1',
  manufacturing_contract_detail_extract: 'manufacturing_contract_detail_extract_1',
};

export interface ApaasAdapterOptions {
  capabilityService: LocalCapabilityService;
  pluginIds?: ApaasPluginMapping;
  timeoutMs?: number;
}

export class ApaasPluginAdapter implements LLMAdapter {
  readonly name = 'apaas-plugin';
  private readonly logger = new Logger(ApaasPluginAdapter.name);
  private readonly capabilityService: LocalCapabilityService;
  private readonly pluginIds: Required<ApaasPluginMapping>;
  private readonly timeoutMs: number;

  constructor(options: ApaasAdapterOptions) {
    this.capabilityService = options.capabilityService;
    this.pluginIds = { ...DEFAULT_PLUGIN_IDS, ...options.pluginIds } as Required<ApaasPluginMapping>;
    this.timeoutMs = options.timeoutMs ?? 100_000;
  }

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    const instanceId = this.pluginIds.welding_cost_calculation_chat_assistant;
    const systemMsg = params.messages.find((m) => m.role === 'system');
    const userMsg = [...params.messages].reverse().find((m) => m.role === 'user');
    const output = await callCapabilityWithTimeout(
      this.capabilityService,
      instanceId,
      'textGenerate',
      {
        user_question: userMsg?.content ?? '',
        system_context: systemMsg?.content ?? '',
      },
      this.timeoutMs,
    ) as { text?: string; result?: string };

    return {
      content: output.text ?? output.result ?? '',
      finishReason: 'stop',
    };
  }

  async *stream(params: LLMChatParams): AsyncIterable<LLMStreamChunk> {
    const result = await this.chat(params);
    yield { delta: result.content, finishReason: result.finishReason };
  }

  async textToJson<TInput extends Record<string, string>, TOutput extends object>(
    params: LLMTextToJsonParams<TInput>,
  ): Promise<TOutput> {
    if (!params.taskKey) {
      throw new Error('ApaasPluginAdapter.textToJson requires params.taskKey');
    }
    const taskDef = getTaskDefinition(params.taskKey);
    const instanceId = this.resolveInstanceId(params.taskKey);
    const action = this.resolveAction(params.taskKey);

    const payload = this.buildPayload(taskDef, params);

    const output = await callCapabilityWithTimeout(
      this.capabilityService,
      instanceId,
      action,
      payload,
      this.timeoutMs,
    ) as Record<string, unknown>;

    return output as TOutput;
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
    return Boolean(this.capabilityService);
  }

  private resolveInstanceId(taskKey: string): string {
    const id = (this.pluginIds as Record<string, string>)[taskKey];
    if (!id) {
      throw new Error(`No plugin instance id mapped for task: ${taskKey}`);
    }
    return id;
  }

  private resolveAction(taskKey: string): string {
    return taskKey === 'welding_cost_calculation_chat_assistant' ? 'textGenerate' : 'textToJson';
  }

  private buildPayload(
    taskDef: ReturnType<typeof getTaskDefinition>,
    params: LLMTextToJsonParams<Record<string, string>>,
  ): Record<string, unknown> {
    const variables = params.variables;

    if (taskDef.key === 'welding_equipment_param_extract') {
      return { equipment_text: variables.equipment_text };
    }
    if (taskDef.key === 'welding_equipment_param_extraction') {
      return {
        device_name: variables.device_name,
        param_name: variables.param_name,
        param_type: variables.param_type,
        description: variables.description ?? '',
      };
    }
    if (taskDef.key === 'welding_cost_anomaly_detection') {
      return { comparison_text: variables.comparison_text };
    }
    if (taskDef.key === 'welding_equipment_intelligent_matching') {
      return {
        device_name: variables.device_name,
        available_models: variables.available_models,
        spec_description: variables.spec_description ?? '',
      };
    }
    if (taskDef.key === 'contract_detail_extract') {
      return { contract_text: variables.contract_text };
    }
    if (taskDef.key === 'manufacturing_contract_detail_extract') {
      return { contract_content: variables.contract_content };
    }

    const rendered = renderPrompt(taskDef.promptTemplate, variables);
    return { input_text: rendered };
  }
}

export function buildJsonSchemaHint(fields?: JsonSchemaField[]): string {
  if (!fields || fields.length === 0) return '';
  return fields.map((f) => `- ${f.name} (${f.type}): ${f.description}`).join('\n');
}
