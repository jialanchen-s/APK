import { Controller, Get, Put, Post, Body, BadRequestException } from '@nestjs/common';
import { NeedLogin } from '@server/common/auth/decorators';
import { SettingsService } from './settings.service';
import { AIGatewayService } from '@server/common/ai/ai-gateway.service';
import { AIConfigService } from './ai-config.service';
import { ImageRecognitionService } from '@server/common/ai/image-recognition.service';

export const AI_CONFIG_KEY = 'ai_provider_config';

export interface AIProviderConfig {
  apiKey?: string;
  model?: string;
  visionModel?: string;
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
    private readonly imageRecognitionService: ImageRecognitionService,
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

  @NeedLogin()
  @Post('image-recognition')
  async recognizeImage(@Body() body: { imageBase64: string; mimeType: string; prompt?: string }) {
    if (!body.imageBase64 || !body.mimeType) {
      throw new BadRequestException('imageBase64 和 mimeType 为必填项');
    }
    const config = await this.aiConfigService.getConfig();
    const defaultProvider = config.providers[config.defaultProvider];
    const visionModel = defaultProvider?.visionModel;
    const result = await this.imageRecognitionService.recognizeImage({
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      prompt: body.prompt,
      model: visionModel,
    });
    return result;
  }
}
