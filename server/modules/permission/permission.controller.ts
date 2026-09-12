import { Controller, Get, Post, Body, Inject } from '@nestjs/common';
import { Can, NeedLogin } from '@server/common/auth/decorators';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { authzPermissions, authzRolePermissions } from '../../database/schema';
import { eq, and, inArray } from 'drizzle-orm';

@Controller('api/permissions')
export class PermissionController {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: any,
  ) {}

  @NeedLogin()
  @Can('manage', 'Permission')
  @Get()
  async listPermissions() {
    return this.db.select().from(authzPermissions);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Get('role-mappings')
  async listRoleMappings() {
    return this.db.select().from(authzRolePermissions);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Post('role-mappings/batch')
  async batchUpdateRoleMappings(
    @Body() dto: { roleKey: string; add: string[]; remove: string[] },
  ) {
    await this.db.transaction(async (tx) => {
      if (dto.remove.length > 0) {
        await tx.delete(authzRolePermissions).where(
          and(
            eq(authzRolePermissions.roleKey, dto.roleKey),
            inArray(authzRolePermissions.permissionId, dto.remove),
          ),
        );
      }
      if (dto.add.length > 0) {
        await tx.insert(authzRolePermissions).values(
          dto.add.map((permissionId) => ({ roleKey: dto.roleKey, permissionId })),
        ).onConflictDoNothing({
          target: [authzRolePermissions.roleKey, authzRolePermissions.permissionId],
        });
      }
    });
    return { success: true };
  }
}
