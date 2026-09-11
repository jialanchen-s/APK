import { OpenAICompatibleAdapter, type OpenAICompatibleConfig } from './openai-compatible-adapter';

export interface DeepSeekConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  organization?: string;
  timeoutMs?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat';

export class DeepSeekAdapter extends OpenAICompatibleAdapter {
  constructor(config: DeepSeekConfig) {
    const full: OpenAICompatibleConfig = {
      name: 'deepseek',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEEPSEEK_BASE_URL,
      model: config.model ?? DEEPSEEK_DEFAULT_MODEL,
      organization: config.organization,
      timeoutMs: config.timeoutMs,
      defaultTemperature: config.defaultTemperature ?? 0.5,
      defaultMaxTokens: config.defaultMaxTokens ?? 8192,
    };
    super(full);
  }
}
