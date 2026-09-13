import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { LocalCapabilityService } from '@server/common/capability/local-capability.service';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { AIGatewayService } from './ai-gateway.service';
import { ApaasPluginAdapter } from './apaas-plugin-adapter';
import { DeepSeekAdapter } from './deepseek-adapter';
import { OpenAIAdapter } from './openai-adapter';
import { GenericOpenAICompatibleAdapter } from './generic-openai-compatible-adapter';
import { MockLLMAdapter } from './mock-adapter';
import {
  buildCustomLLMConfig,
  buildDeepSeekConfig,
  buildGatewayConfig,
  buildOpenAIConfig,
  readAIProviderEnv,
} from './ai-env.config';
import { appSettings } from '@server/database/schema';

type DrizzleDb = ReturnType<typeof import('drizzle-orm/node-postgres').drizzle>;

const AI_CONFIG_KEY = 'ai_provider_config';

interface AIProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  organization?: string;
  name?: string;
}

interface AIProviderSettings {
  defaultProvider: string;
  providers: Record<string, AIProviderConfig>;
}

@Injectable()
export class AIBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AIBootstrapService.name);

  constructor(
    private readonly gateway: AIGatewayService,
    @Optional() @Inject() private readonly capabilityService: LocalCapabilityService,
    @Optional() @Inject(DRIZZLE_DATABASE) private readonly db: DrizzleDb,
  ) {}

  async onModuleInit(): Promise<void> {
    const env = readAIProviderEnv();

    const mockAdapter = new MockLLMAdapter();
    this.gateway.registerAdapter(mockAdapter);

    if (this.capabilityService) {
      this.gateway.registerAdapter(
        new ApaasPluginAdapter({ capabilityService: this.capabilityService }),
      );
    } else {
      this.logger.warn('CapabilityService not available — ApaasPluginAdapter skipped');
    }

    const dbConfig = await this.loadDBConfig();
    if (dbConfig) {
      this.applyDBConfig(dbConfig);
      return;
    }

    this.applyEnvConfig(env);
  }

  private async loadDBConfig(): Promise<AIProviderSettings | null> {
    if (!this.db) return null;
    try {
      const rows = await this.db.select().from(appSettings).where(eq(appSettings.key, AI_CONFIG_KEY)).limit(1);
      if (rows.length === 0) return null;
      return rows[0].value as AIProviderSettings;
    } catch {
      this.logger.warn('Failed to load AI config from database, falling back to env');
      return null;
    }
  }

  private applyDBConfig(config: AIProviderSettings): void {
    let hasRealProvider = false;

    const ds = config.providers.deepseek;
    if (ds?.apiKey) {
      this.gateway.registerAdapter(new DeepSeekAdapter({
        apiKey: ds.apiKey,
        model: ds.model,
        baseUrl: ds.baseUrl,
      }));
      this.logger.log(`DeepSeek adapter registered from DB (model=${ds.model ?? 'deepseek-chat'})`);
      hasRealProvider = true;
    }

    const oi = config.providers.openai;
    if (oi?.apiKey) {
      this.gateway.registerAdapter(new OpenAIAdapter({
        apiKey: oi.apiKey,
        model: oi.model,
        baseUrl: oi.baseUrl,
        organization: oi.organization,
      }));
      this.logger.log(`OpenAI adapter registered from DB (model=${oi.model ?? 'gpt-4o-mini'})`);
      hasRealProvider = true;
    }

    const custom = config.providers.custom;
    if (custom?.apiKey && custom?.baseUrl && custom?.model && custom?.name) {
      this.gateway.registerAdapter(new GenericOpenAICompatibleAdapter({
        name: custom.name,
        apiKey: custom.apiKey,
        baseUrl: custom.baseUrl,
        model: custom.model,
      }));
      this.logger.log(`Custom LLM adapter registered from DB: ${custom.name}`);
      hasRealProvider = true;
    }

    const env = readAIProviderEnv();
    const gatewayCfg = buildGatewayConfig(env);
    gatewayCfg.defaultAdapter = hasRealProvider ? config.defaultProvider : 'mock';

    this.gateway.configure(gatewayCfg);
    this.logger.log(`AI Gateway configured from DB: default=${gatewayCfg.defaultAdapter}`);
  }

  private applyEnvConfig(env: ReturnType<typeof readAIProviderEnv>): void {
    let hasRealLLMProvider = false;

    const deepseekCfg = buildDeepSeekConfig(env);
    if (deepseekCfg) {
      this.gateway.registerAdapter(new DeepSeekAdapter(deepseekCfg));
      this.logger.log(`DeepSeek adapter registered (model=${deepseekCfg.model ?? 'deepseek-chat'})`);
      hasRealLLMProvider = true;
    }

    const openaiCfg = buildOpenAIConfig(env);
    if (openaiCfg) {
      this.gateway.registerAdapter(new OpenAIAdapter(openaiCfg));
      this.logger.log(`OpenAI adapter registered (model=${openaiCfg.model ?? 'gpt-4o-mini'})`);
      hasRealLLMProvider = true;
    }

    const customCfg = buildCustomLLMConfig(env);
    if (customCfg) {
      this.gateway.registerAdapter(new GenericOpenAICompatibleAdapter(customCfg));
      this.logger.log(`Custom LLM adapter registered: ${customCfg.name}`);
      hasRealLLMProvider = true;
    }

    const gatewayCfg = buildGatewayConfig(env);

    if (env.AI_DEFAULT_PROVIDER === 'mock' || (!hasRealLLMProvider && !env.AI_DEFAULT_PROVIDER)) {
      gatewayCfg.defaultAdapter = 'mock';
      this.logger.log('Using MockLLMAdapter as default (no real LLM providers available)');
    }

    this.gateway.configure(gatewayCfg);
    this.logger.log(
      `AI Gateway configured from env: default=${gatewayCfg.defaultAdapter}, routes=${gatewayCfg.routes?.length ?? 0}`,
    );
  }
}
