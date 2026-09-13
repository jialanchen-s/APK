import { Controller, Get, Put, Body } from '@nestjs/common';
import { NeedLogin } from '@server/common/auth/decorators';
import { SettingsService } from './settings.service';
import { AIGatewayService } from '@server/common/ai/ai-gateway.service';
import { AIConfigService } from './ai-config.service';

export const AI_CONFIG_KEY = 'ai_provider_config';

export interface AIProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  organization?: string;
  name?: string;
}

export interface AIProviderSettings {
  defaultProvider: string;
  providers: Record<string, AIProviderConfig>;
}

function maskApiKey(key?: string): string {
  if (!key || key.length <= 8) return key ? '****' : '';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

@Controller('api/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly aiConfigService: AIConfigService,
    private readonly gateway: AIGatewayService,
  ) {}

  @NeedLogin()
  @Get('ai-config')
  async getAIConfig() {
    const config = await this.aiConfigService.getConfig();
    const maskedProviders: Record<string, any> = {};
    for (const [name, provider] of Object.entries(config.providers)) {
      maskedProviders[name] = {
        ...provider,
        apiKey: maskApiKey(provider.apiKey),
        _configured: !!provider.apiKey,
      };
    }
    return {
      defaultProvider: config.defaultProvider,
      providers: maskedProviders,
    };
  }

  @NeedLogin()
  @Put('ai-config')
  async updateAIConfig(@Body() body: AIProviderSettings) {
    await this.settingsService.set(AI_CONFIG_KEY, body);
    await this.aiConfigService.reloadGateway();
    return { success: true };
  }

  @NeedLogin()
  @Get('ai-config/status')
  async getAIStatus() {
    const config = await this.aiConfigService.getConfig();
    const adapters = this.gateway.listAdapters();
    const defaultAdapter = this.gateway.getDefaultAdapter();
    return {
      defaultProvider: config.defaultProvider,
      activeAdapter: defaultAdapter?.name ?? null,
      registeredAdapters: adapters.map((a) => a.name),
    };
  }
}
