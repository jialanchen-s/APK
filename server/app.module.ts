import { APP_FILTER } from '@nestjs/core';
import { Module, Logger, MiddlewareConsumer, NestModule } from '@nestjs/common';

process.on('unhandledRejection', (reason) => {
  const detail = reason instanceof Error ? `${reason.message}\n${reason.stack}` : JSON.stringify(reason);
  new Logger('Process').error(`unhandledRejection: ${detail}`);
});

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { DatabaseModule } from './common/database/database.module';
import { CapabilityModule } from './common/capability/capability.module';
import { FileStorageModule } from './common/file/file-storage.module';
import { AuthorizationModule } from './common/auth/authorization.module';
import { UserContextMiddleware } from './common/auth/user-context.middleware';
import { PermissionModule } from './modules/permission/permission.module';
import { RoleManagerModule } from './modules/role-manager/role-manager.module';
import { EstimateTaskModule } from './modules/estimate-task/estimate-task.module';
import { PendingItemModule } from './modules/pending-item/pending-item.module';
import { ContractModule } from './modules/contract/contract.module';
import { ModelModule } from './modules/model/model.module';
import { AgentModule } from './modules/agent/agent.module';
import { PriceQueryModule } from './modules/price-query/price-query.module';
import { ViewModule } from './modules/view/view.module';
import { AIModule } from './common/ai/ai.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    DatabaseModule,
    CapabilityModule,
    FileStorageModule,
    AuthorizationModule,
    AIModule,
    // ====== @route-section: business-modules START ======
    PermissionModule,
    RoleManagerModule,
    EstimateTaskModule,
    PendingItemModule,
    ContractModule,
    ModelModule,
    AgentModule,
    PriceQueryModule,
    SettingsModule,
    // ====== @route-section: business-modules END ======
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(UserContextMiddleware).forRoutes('*');
  }
}
