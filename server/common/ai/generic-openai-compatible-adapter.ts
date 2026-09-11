import { OpenAICompatibleAdapter, type OpenAICompatibleConfig } from './openai-compatible-adapter';

export interface GenericOpenAICompatibleConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  organization?: string;
  timeoutMs?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export class GenericOpenAICompatibleAdapter extends OpenAICompatibleAdapter {
  constructor(config: GenericOpenAICompatibleConfig) {
    const full: OpenAICompatibleConfig = {
      name: config.name,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      organization: config.organization,
      timeoutMs: config.timeoutMs,
      defaultTemperature: config.defaultTemperature ?? 0.5,
      defaultMaxTokens: config.defaultMaxTokens ?? 8192,
    };
    super(full);
  }
}
