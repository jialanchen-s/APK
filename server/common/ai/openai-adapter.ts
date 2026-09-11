import { OpenAICompatibleAdapter, type OpenAICompatibleConfig } from './openai-compatible-adapter';

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  organization?: string;
  timeoutMs?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

export class OpenAIAdapter extends OpenAICompatibleAdapter {
  constructor(config: OpenAIConfig) {
    const full: OpenAICompatibleConfig = {
      name: 'openai',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? OPENAI_BASE_URL,
      model: config.model ?? OPENAI_DEFAULT_MODEL,
      organization: config.organization,
      timeoutMs: config.timeoutMs,
      defaultTemperature: config.defaultTemperature ?? 0.5,
      defaultMaxTokens: config.defaultMaxTokens ?? 8192,
    };
    super(full);
  }
}
