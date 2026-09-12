import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { LocalCapabilityService } from '@server/common/capability/local-capability.service';
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

@Injectable()
export class AIBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AIBootstrapService.name);

  constructor(
    private readonly gateway: AIGatewayService,
    @Optional() @Inject() private readonly capabilityService: LocalCapabilityService,
  ) {}

  onModuleInit(): void {
    const env = readAIProviderEnv();

    const mockAdapter = new MockLLMAdapter();
    this.gateway.registerAdapter(mockAdapter);

    let hasRealLLMProvider = false;

    if (this.capabilityService) {
      this.gateway.registerAdapter(
        new ApaasPluginAdapter({ capabilityService: this.capabilityService }),
      );
    } else {
      this.logger.warn('CapabilityService not available — ApaasPluginAdapter skipped');
    }

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
      `AI Gateway configured: default=${gatewayCfg.defaultAdapter}, routes=${gatewayCfg.routes?.length ?? 0}`,
    );
  }
}
