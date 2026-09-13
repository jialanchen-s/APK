import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AIConfigService } from './ai-config.service';
import { AIModule } from '@server/common/ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [SettingsController],
  providers: [SettingsService, AIConfigService],
  exports: [SettingsService, AIConfigService],
})
export class SettingsModule {}
