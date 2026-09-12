import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { DbPermissionResolver } from './modules/permission/db-permission-resolver';
import { PermissionModule } from './modules/permission/permission.module';
import { RoleManagerModule } from './modules/role-manager/role-manager.module';
import { EstimateTaskModule } from './modules/estimate-task/estimate-task.module';
import { PendingItemModule } from './modules/pending-item/pending-item.module';
import { ContractModule } from './modules/contract/contract.module';
import { ModelModule } from './modules/model/model.module';
import { AgentModule } from './modules/agent/agent.module';
import { PriceQueryModule } from './modules/price-query/price-query.module';
import { ViewModule } from './modules/view/view.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    PlatformModule.forRoot({
      authz: { permissionResolver: DbPermissionResolver },
    }),
    // ====== @route-section: business-modules START ======
    PermissionModule,
    RoleManagerModule,
    EstimateTaskModule,
    PendingItemModule,
    ContractModule,
    ModelModule,
    AgentModule,
    PriceQueryModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
