import { Injectable, Logger } from '@nestjs/common';
import type {
  JsonValue,
  LLMAdapter,
  LLMChatParams,
  LLMChatResult,
  LLMStreamChunk,
  LLMTextToJsonParams,
  TextToJsonFn,
} from './llm-adapter.interface';
import { getTaskDefinition } from './task-registry';

export interface AIGatewayRoute {
  taskKey: string;
  primary: string;
  fallbacks?: string[];
  cacheTtlMs?: number;
  disableCache?: boolean;
}

export interface AIGatewayConfig {
  defaultAdapter: string;
  routes?: AIGatewayRoute[];
  cache?: {
    maxSize?: number;
    defaultTtlMs?: number;
  };
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class AIGatewayService {
  private readonly logger = new Logger(AIGatewayService.name);
  private readonly adapters = new Map<string, LLMAdapter>();
  private readonly cache = new Map<string, CacheEntry>();
  private config: AIGatewayConfig = { defaultAdapter: 'apaas-plugin' };

  registerAdapter(adapter: LLMAdapter): void {
    this.adapters.set(adapter.name, adapter);
    this.logger.log(`Registered LLM adapter: ${adapter.name}`);
  }

  configure(config: AIGatewayConfig): void {
    this.config = config;
    this.cache.clear();
  }

  getAdapter(name: string): LLMAdapter | undefined {
    return this.adapters.get(name);
  }

  getDefaultAdapter(): LLMAdapter | undefined {
    return this.adapters.get(this.config.defaultAdapter);
  }

  listAdapters(): Array<{ name: string; available: boolean }> {
    return Array.from(this.adapters.values()).map((a) => ({ name: a.name, available: true }));
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

  async chat(params: LLMChatParams & { taskKey?: string }): Promise<LLMChatResult> {
    const route = this.resolveRoute(params.taskKey);
    const chain = this.buildChain(route?.primary);

    let lastError: unknown;
    for (const adapter of chain) {
      try {
        return await adapter.chat(params);
      } catch (err) {
        lastError = err;
        this.logger.warn(`chat failed on adapter ${adapter.name}, trying fallback`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    throw lastError ?? new Error('No adapter available for chat');
  }

  async *stream(params: LLMChatParams & { taskKey?: string }): AsyncIterable<LLMStreamChunk> {
    const route = this.resolveRoute(params.taskKey);
    const chain = this.buildChain(route?.primary);

    let lastError: unknown;
    for (const adapter of chain) {
      try {
        yield* adapter.stream(params);
        return;
      } catch (err) {
        lastError = err;
        this.logger.warn(`stream failed on adapter ${adapter.name}, trying fallback`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    throw lastError ?? new Error('No adapter available for stream');
  }

  async textToJson<TInput extends Record<string, string>, TOutput extends object>(
    params: LLMTextToJsonParams<TInput>,
  ): Promise<TOutput> {
    if (!params.taskKey) {
      throw new Error('AIGatewayService.textToJson requires params.taskKey');
    }

    const route = this.resolveRoute(params.taskKey);
    const cacheKey = route?.disableCache ? null : this.buildCacheKey(params);

    if (cacheKey) {
      const cached = this.readCache<TOutput>(cacheKey);
      if (cached !== undefined) return cached;
    }

    const chain = this.buildChain(route?.primary);
    let lastError: unknown;

    for (const adapter of chain) {
      try {
        const result = await adapter.textToJson<TInput, TOutput>(params);
        if (cacheKey) {
          this.writeCache(cacheKey, result, route?.cacheTtlMs);
        }
        return result;
      } catch (err) {
        lastError = err;
        this.logger.warn(`textToJson failed on adapter ${adapter.name}, trying fallback`, {
          taskKey: params.taskKey,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    throw lastError ?? new Error(`No adapter available for task ${params.taskKey}`);
  }

  clearCache(): void {
    this.cache.clear();
  }

  private resolveRoute(taskKey?: string): AIGatewayRoute | undefined {
    if (!taskKey || !this.config.routes) return undefined;
    return this.config.routes.find((r) => r.taskKey === taskKey);
  }

  private buildChain(primaryAdapterName?: string): LLMAdapter[] {
    const chain: LLMAdapter[] = [];
    const seen = new Set<string>();

    const push = (name?: string) => {
      if (!name) return;
      if (seen.has(name)) return;
      const adapter = this.adapters.get(name);
      if (!adapter) {
        this.logger.warn(`adapter not registered: ${name}`);
        return;
      }
      chain.push(adapter);
      seen.add(name);
    };

    if (primaryAdapterName) {
      push(primaryAdapterName);
    } else {
      push(this.config.defaultAdapter);
    }

    return chain;
  }

  private buildCacheKey(params: LLMTextToJsonParams<Record<string, string>>): string {
    const sortedVars = Object.keys(params.variables)
      .sort()
      .map((k) => `${k}=${params.variables[k]}`)
      .join('|');
    return `${params.taskKey}:${sortedVars}`;
  }

  private readCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private writeCache(key: string, value: unknown, ttlMs?: number): void {
    const ttl = ttlMs ?? this.config.cache?.defaultTtlMs ?? 1000 * 60 * 60;
    const maxSize = this.config.cache?.maxSize ?? 1000;

    if (this.cache.size >= maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { value, expiresAt: Date.now() + ttl });
  }
}
