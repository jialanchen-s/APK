import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import { AIGatewayService } from './ai-gateway.service';
import { ApaasPluginAdapter } from './apaas-plugin-adapter';
import { DeepSeekAdapter } from './deepseek-adapter';
import { OpenAIAdapter } from './openai-adapter';
import { GenericOpenAICompatibleAdapter } from './generic-openai-compatible-adapter';
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
    @Inject() private readonly capabilityService: CapabilityService,
  ) {}

  onModuleInit(): void {
    const env = readAIProviderEnv();

    this.gateway.registerAdapter(
      new ApaasPluginAdapter({ capabilityService: this.capabilityService }),
    );

    const deepseekCfg = buildDeepSeekConfig(env);
    if (deepseekCfg) {
      this.gateway.registerAdapter(new DeepSeekAdapter(deepseekCfg));
      this.logger.log(`DeepSeek adapter registered (model=${deepseekCfg.model ?? 'deepseek-chat'})`);
    }

    const openaiCfg = buildOpenAIConfig(env);
    if (openaiCfg) {
      this.gateway.registerAdapter(new OpenAIAdapter(openaiCfg));
      this.logger.log(`OpenAI adapter registered (model=${openaiCfg.model ?? 'gpt-4o-mini'})`);
    }

    const customCfg = buildCustomLLMConfig(env);
    if (customCfg) {
      this.gateway.registerAdapter(new GenericOpenAICompatibleAdapter(customCfg));
      this.logger.log(`Custom LLM adapter registered: ${customCfg.name}`);
    }

    const gatewayCfg = buildGatewayConfig(env);
    this.gateway.configure(gatewayCfg);
    this.logger.log(
      `AI Gateway configured: default=${gatewayCfg.defaultAdapter}, routes=${gatewayCfg.routes?.length ?? 0}`,
    );
  }
}
