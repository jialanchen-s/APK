import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AI_CONFIG_KEY, AIProviderSettings } from './settings.controller';
import { AIGatewayService } from '@server/common/ai/ai-gateway.service';
import { readAIProviderEnv, buildGatewayConfig } from '@server/common/ai/ai-env.config';
import { DeepSeekAdapter } from '@server/common/ai/deepseek-adapter';
import { OpenAIAdapter } from '@server/common/ai/openai-adapter';
import { GenericOpenAICompatibleAdapter } from '@server/common/ai/generic-openai-compatible-adapter';
import { MockLLMAdapter } from '@server/common/ai/mock-adapter';

@Injectable()
export class AIConfigService {
  private readonly logger = new Logger(AIConfigService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly gateway: AIGatewayService,
  ) {}

  async getConfig(): Promise<AIProviderSettings> {
    const dbConfig = await this.settingsService.get<AIProviderSettings>(AI_CONFIG_KEY);
    if (dbConfig) return dbConfig;

    const env = readAIProviderEnv();
    return {
      defaultProvider: env.AI_DEFAULT_PROVIDER ?? 'mock',
      providers: this.buildProvidersFromEnv(env),
    };
  }

  async reloadGateway(): Promise<void> {
    const config = await this.getConfig();
    const env = readAIProviderEnv();

    if (config.providers.deepseek?.apiKey) {
      const adapter = new DeepSeekAdapter({
        apiKey: config.providers.deepseek.apiKey,
        model: config.providers.deepseek.model,
        baseUrl: config.providers.deepseek.baseUrl,
      });
      this.gateway.registerAdapter(adapter);
      this.logger.log(`DeepSeek adapter registered from DB config`);
    }

    if (config.providers.openai?.apiKey) {
      const adapter = new OpenAIAdapter({
        apiKey: config.providers.openai.apiKey,
        model: config.providers.openai.model,
        baseUrl: config.providers.openai.baseUrl,
        organization: config.providers.openai.organization,
      });
      this.gateway.registerAdapter(adapter);
      this.logger.log(`OpenAI adapter registered from DB config`);
    }

    const custom = config.providers.custom;
    if (custom?.apiKey && custom?.baseUrl && custom?.model && custom?.name) {
      const adapter = new GenericOpenAICompatibleAdapter({
        name: custom.name,
        apiKey: custom.apiKey,
        baseUrl: custom.baseUrl,
        model: custom.model,
      });
      this.gateway.registerAdapter(adapter);
      this.logger.log(`Custom LLM adapter registered from DB config: ${custom.name}`);
    }

    const gatewayCfg = buildGatewayConfig(env);
    const hasRealProvider = !!(
      config.providers.deepseek?.apiKey ||
      config.providers.openai?.apiKey ||
      (custom?.apiKey && custom?.baseUrl && custom?.model && custom?.name)
    );

    if (config.defaultProvider === 'mock' || (!hasRealProvider && !config.defaultProvider)) {
      gatewayCfg.defaultAdapter = 'mock';
    } else {
      gatewayCfg.defaultAdapter = config.defaultProvider;
    }

    this.gateway.configure(gatewayCfg);
    this.logger.log(`AI Gateway reconfigured: default=${gatewayCfg.defaultAdapter}`);
  }

  private buildProvidersFromEnv(env: ReturnType<typeof readAIProviderEnv>): Record<string, any> {
    const providers: Record<string, any> = {};
    if (env.DEEPSEEK_API_KEY) {
      providers.deepseek = {
        apiKey: env.DEEPSEEK_API_KEY,
        model: env.DEEPSEEK_MODEL,
        baseUrl: env.DEEPSEEK_BASE_URL,
      };
    }
    if (env.OPENAI_API_KEY) {
      providers.openai = {
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        baseUrl: env.OPENAI_BASE_URL,
        organization: env.OPENAI_ORGANIZATION,
      };
    }
    if (env.CUSTOM_LLM_API_KEY && env.CUSTOM_LLM_BASE_URL && env.CUSTOM_LLM_MODEL && env.CUSTOM_LLM_NAME) {
      providers.custom = {
        name: env.CUSTOM_LLM_NAME,
        apiKey: env.CUSTOM_LLM_API_KEY,
        baseUrl: env.CUSTOM_LLM_BASE_URL,
        model: env.CUSTOM_LLM_MODEL,
      };
    }
    return providers;
  }
}
