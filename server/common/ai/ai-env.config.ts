import type { AIGatewayConfig, AIGatewayRoute } from './ai-gateway.service';
import type { DeepSeekConfig } from './deepseek-adapter';
import type { OpenAIConfig } from './openai-adapter';
import type { GenericOpenAICompatibleConfig } from './generic-openai-compatible-adapter';

export interface AIProviderEnv {
  AI_DEFAULT_PROVIDER?: 'deepseek' | 'openai' | 'apaas-plugin' | 'custom';
  AI_FALLBACK_CHAIN?: string;

  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_BASE_URL?: string;

  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_ORGANIZATION?: string;

  CUSTOM_LLM_NAME?: string;
  CUSTOM_LLM_API_KEY?: string;
  CUSTOM_LLM_BASE_URL?: string;
  CUSTOM_LLM_MODEL?: string;

  AI_CACHE_MAX_SIZE?: string;
  AI_CACHE_DEFAULT_TTL_MS?: string;
  AI_ROUTES_JSON?: string;
}

export function readAIProviderEnv(): AIProviderEnv {
  return {
    AI_DEFAULT_PROVIDER: process.env.AI_DEFAULT_PROVIDER as AIProviderEnv['AI_DEFAULT_PROVIDER'],
    AI_FALLBACK_CHAIN: process.env.AI_FALLBACK_CHAIN,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_ORGANIZATION: process.env.OPENAI_ORGANIZATION,
    CUSTOM_LLM_NAME: process.env.CUSTOM_LLM_NAME,
    CUSTOM_LLM_API_KEY: process.env.CUSTOM_LLM_API_KEY,
    CUSTOM_LLM_BASE_URL: process.env.CUSTOM_LLM_BASE_URL,
    CUSTOM_LLM_MODEL: process.env.CUSTOM_LLM_MODEL,
    AI_CACHE_MAX_SIZE: process.env.AI_CACHE_MAX_SIZE,
    AI_CACHE_DEFAULT_TTL_MS: process.env.AI_CACHE_DEFAULT_TTL_MS,
    AI_ROUTES_JSON: process.env.AI_ROUTES_JSON,
  };
}

export function buildDeepSeekConfig(env: AIProviderEnv): DeepSeekConfig | null {
  if (!env.DEEPSEEK_API_KEY) return null;
  return {
    apiKey: env.DEEPSEEK_API_KEY,
    model: env.DEEPSEEK_MODEL,
    baseUrl: env.DEEPSEEK_BASE_URL,
  };
}

export function buildOpenAIConfig(env: AIProviderEnv): OpenAIConfig | null {
  if (!env.OPENAI_API_KEY) return null;
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    baseUrl: env.OPENAI_BASE_URL,
    organization: env.OPENAI_ORGANIZATION,
  };
}

export function buildCustomLLMConfig(env: AIProviderEnv): GenericOpenAICompatibleConfig | null {
  if (!env.CUSTOM_LLM_API_KEY || !env.CUSTOM_LLM_BASE_URL || !env.CUSTOM_LLM_MODEL || !env.CUSTOM_LLM_NAME) {
    return null;
  }
  return {
    name: env.CUSTOM_LLM_NAME,
    apiKey: env.CUSTOM_LLM_API_KEY,
    baseUrl: env.CUSTOM_LLM_BASE_URL,
    model: env.CUSTOM_LLM_MODEL,
  };
}

export function buildGatewayConfig(env: AIProviderEnv): AIGatewayConfig {
  const defaultAdapter = env.AI_DEFAULT_PROVIDER ?? 'apaas-plugin';

  const fallbackChain = env.AI_FALLBACK_CHAIN
    ? env.AI_FALLBACK_CHAIN.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const routes: AIGatewayRoute[] = env.AI_ROUTES_JSON
    ? parseRoutesJson(env.AI_ROUTES_JSON)
    : [];

  return {
    defaultAdapter,
    routes,
    cache: {
      maxSize: env.AI_CACHE_MAX_SIZE ? parseInt(env.AI_CACHE_MAX_SIZE, 10) : 1000,
      defaultTtlMs: env.AI_CACHE_DEFAULT_TTL_MS ? parseInt(env.AI_CACHE_DEFAULT_TTL_MS, 10) : 1000 * 60 * 60,
    },
  };

  function parseRoutesJson(raw: string): AIGatewayRoute[] {
    try {
      const parsed = JSON.parse(raw) as AIGatewayRoute[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((r) => r && typeof r.taskKey === 'string' && typeof r.primary === 'string');
    } catch {
      return [];
    }
  }
}
