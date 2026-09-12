import { Injectable } from '@nestjs/common';
import { authzRolePermissions, authzPermissions } from '@server/database/schema';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { eq, inArray } from 'drizzle-orm';

export interface PermissionPoint {
  id: number;
  action: string;
  subject: string;
  description?: string;
}

@Injectable()
export class AuthorizationService {
  readonly roles: {
    list: () => Promise<any[]>;
    get: (bizID: string) => Promise<any>;
    create: (dto: any) => Promise<any>;
    update: (bizID: string, dto: any) => Promise<any>;
    delete: (bizID: string) => Promise<any>;
  };

  readonly members: {
    list: (bizID: string, query: any) => Promise<any[]>;
    add: (bizID: string, dto: any) => Promise<any>;
    remove: (bizID: string, dto: any) => Promise<any>;
    clear: (bizID: string) => Promise<any>;
  };

  readonly search: {
    search: (dto: any) => Promise<any[]>;
  };

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: any,
  ) {
    this.roles = {
      list: async () => [],
      get: async (bizID: string) => ({ bizID, name: bizID, description: '' }),
      create: async (dto: any) => dto.role,
      update: async (bizID: string, dto: any) => ({ bizID, ...dto.role }),
      delete: async () => ({ success: true }),
    };

    this.members = {
      list: async () => [],
      add: async () => ({ success: true }),
      remove: async () => ({ success: true }),
      clear: async () => ({ success: true }),
    };

    this.search = {
      search: async () => [],
    };
  }

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
