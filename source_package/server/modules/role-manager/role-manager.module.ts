import { Module } from '@nestjs/common';
import { RoleManagerController } from './role-manager.controller';

@Module({
  controllers: [RoleManagerController],
})
export class RoleManagerModule {}
