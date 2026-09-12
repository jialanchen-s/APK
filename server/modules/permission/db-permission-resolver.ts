import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { authzRolePermissions, authzPermissions } from '../../database/schema';
import { inArray, eq } from 'drizzle-orm';

export interface PermissionPoint {
  id: number;
  action: string;
  subject: string;
  description?: string;
}

@Injectable()
export class DbPermissionResolver {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: any,
  ) {}

  async resolvePermissions(roleKeys: string[]): Promise<PermissionPoint[]> {
    if (roleKeys.length === 0) return [];
    const rows = await this.db
      .select({
        id: authzPermissions.id,
        action: authzPermissions.action,
        subject: authzPermissions.subject,
        description: authzPermissions.description,
      })
      .from(authzRolePermissions)
      .innerJoin(authzPermissions, eq(authzRolePermissions.permissionId, authzPermissions.id))
      .where(inArray(authzRolePermissions.roleKey, roleKeys));
    const seen = new Set<string>();
    return rows.filter((r) => {
      const key = `${r.action}:${r.subject}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((r) => ({
      id: r.id,
      action: r.action,
      subject: r.subject,
      description: r.description ?? undefined,
    }));
  }
}
