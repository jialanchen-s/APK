import { Logger } from '@nestjs/common';
import type {
  ChatMessage,
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

export interface OpenAICompatibleConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  organization?: string;
  timeoutMs?: number;
}

export abstract class OpenAICompatibleAdapter implements LLMAdapter {
  protected readonly logger: Logger;
  protected readonly config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
    this.logger = new Logger(`LLMAdapter:${config.name}`);
  }

  get name(): string {
    return this.config.name;
  }

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    const body = this.buildRequestBody(params, false);
    const data = await this.request<{
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    }>('/chat/completions', body);

    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      finishReason: this.mapFinishReason(choice?.finish_reason),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *stream(params: LLMChatParams): AsyncIterable<LLMStreamChunk> {
    const body = this.buildRequestBody(params, true);
    const response = await this.rawFetch('/chat/completions', { ...body, stream: true });

    if (!response.body) {
      throw new Error(`${this.name}: streaming response body is null`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') return;
          try {
            const json = JSON.parse(payload) as {
              choices: Array<{ delta: { content?: string }; finish_reason?: string }>;
            };
            const delta = json.choices?.[0]?.delta?.content ?? '';
            const finishReason = json.choices?.[0]?.finish_reason
              ? this.mapFinishReason(json.choices[0].finish_reason)
              : undefined;
            if (delta || finishReason) {
              yield { delta, finishReason };
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async textToJson<TInput extends Record<string, string>, TOutput extends object>(
    params: LLMTextToJsonParams<TInput>,
  ): Promise<TOutput> {
    const taskDef = params.taskKey ? getTaskDefinition(params.taskKey) : undefined;

    const schema: JsonSchemaField[] | undefined = params.schema ?? taskDef?.jsonSchema;
    const temperature = params.temperature ?? taskDef?.defaults?.temperature ?? this.config.defaultTemperature ?? 0.3;
    const maxTokens = params.maxTokens ?? taskDef?.defaults?.maxTokens ?? this.config.defaultMaxTokens ?? 4096;

    const prompt = taskDef
      ? renderPrompt(taskDef.promptTemplate, params.variables as Record<string, string>)
      : this.buildSchemaPrompt(params.variables as Record<string, string>, schema);

    const result = await this.chat({
      messages: [
        { role: 'system', content: '你是专业的工业数据分析助手，必须输出合法的 JSON 对象，禁止输出任何 markdown 标记或额外说明文字。' },
        { role: 'user', content: prompt },
      ],
      temperature,
      maxTokens,
      responseFormat: 'json',
      signal: params.signal,
    });

    return this.parseJsonOutput<TOutput>(result.content);
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
    if (!this.config.apiKey) return false;
    try {
      const response = await this.rawFetch('/models', {}, 'GET');
      return response.ok;
    } catch {
      return false;
    }
  }

  protected buildRequestBody(params: LLMChatParams, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: params.temperature ?? this.config.defaultTemperature ?? 0.7,
      max_tokens: params.maxTokens ?? this.config.defaultMaxTokens ?? 4096,
      stream,
    };
    if (params.topP !== undefined) body.top_p = params.topP;
    if (params.stop) body.stop = params.stop;
    if (params.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }
    return body;
  }

  protected buildSchemaPrompt(variables: Record<string, string>, schema?: JsonSchemaField[]): string {
    const varText = Object.entries(variables)
      .map(([k, v]) => `【${k}】\n${v}`)
      .join('\n\n');
    if (!schema) return varText;
    const schemaDesc = schema
      .map((f) => `- ${f.name} (${f.type}): ${f.description}`)
      .join('\n');
    return `${varText}\n\n请按以下 JSON 字段定义输出结果：\n${schemaDesc}`;
  }

  protected async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.rawFetch(path, body);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`${this.name} API ${response.status}: ${text}`);
    }
    return (await response.json()) as T;
  }

  protected async rawFetch(path: string, body: Record<string, unknown>, method: string = 'POST'): Promise<Response> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
    if (this.config.organization) headers['OpenAI-Organization'] = this.config.organization;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 100_000);

    try {
      return await fetch(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  protected parseJsonOutput<T>(content: string): T {
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch (err) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          throw new Error(`${this.name}: failed to parse JSON output: ${(err as Error).message}`);
        }
      }
      throw new Error(`${this.name}: failed to parse JSON output: ${(err as Error).message}`);
    }
  }

  private mapFinishReason(reason?: string): LLMChatResult['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return reason ? 'error' : undefined;
    }
  }
}

export function normalizeMessages(systemPrompt: string, userContent: string): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}
