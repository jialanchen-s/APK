import { Injectable, Inject } from '@nestjs/common';
import { authzRolePermissions, authzPermissions, authzRoles } from '@server/database/schema';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { eq, inArray, sql, ilike } from 'drizzle-orm';

export interface PermissionPoint {
  id: number;
  action: string;
  subject: string;
  description?: string;
}

interface RoleMembersData {
  userList?: any[];
  departmentList?: any[];
  groupChatList?: any[];
  allEmployees?: any;
  public?: any;
  presetGroup?: any;
  [key: string]: any;
}

function toForceRoleDTO(row: any) {
  return {
    bizID: row.bizID,
    name: row.name,
    description: row.description ?? '',
    roleMembers: (row.roleMembers as RoleMembersData) ?? {},
  };
}

function buildRoleMembersFromInput(input: any): RoleMembersData {
  const rm: RoleMembersData = {};
  if (Array.isArray(input.userList)) rm.userList = input.userList;
  if (Array.isArray(input.departmentList)) rm.departmentList = input.departmentList;
  if (Array.isArray(input.groupChatList)) rm.groupChatList = input.groupChatList;
  if (input.isContainsAdmin != null) rm.presetGroup = { isContainsAdmin: input.isContainsAdmin };
  if (input.allEmployees != null) rm.allEmployees = input.allEmployees;
  if (input.public != null) rm.public = input.public;
  return rm;
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
    search: (dto: any) => Promise<any>;
  };

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: any,
  ) {
    this.roles = {
      list: async () => {
        const rows = await this.db.select().from(authzRoles);
        return rows.map(toForceRoleDTO);
      },

      get: async (bizID: string) => {
        const rows = await this.db.select().from(authzRoles)
          .where(eq(authzRoles.bizID, bizID)).limit(1);
        if (rows.length === 0) return { bizID, name: bizID, description: '', roleMembers: {} };
        return toForceRoleDTO(rows[0]);
      },

      create: async (dto: any) => {
        const { name, bizID, description } = dto.role;
        await this.db.insert(authzRoles).values({
          bizID,
          name,
          description: description ?? null,
          roleMembers: {},
        });
        return { bizID, name, description: description ?? '' };
      },

      update: async (bizID: string, dto: any) => {
        const updates: Record<string, any> = {};
        if (dto.role.name != null) updates.name = dto.role.name;
        if (dto.role.description !== undefined) updates.description = dto.role.description || null;
        if (Object.keys(updates).length > 0) {
          await this.db.update(authzRoles).set(updates)
            .where(eq(authzRoles.bizID, bizID));
        }
        return { bizID, ...dto.role };
      },

      delete: async (bizID: string) => {
        await this.db.transaction(async (tx: any) => {
          await tx.delete(authzRolePermissions).where(eq(authzRolePermissions.roleKey, bizID));
          await tx.delete(authzRoles).where(eq(authzRoles.bizID, bizID));
        });
        return { success: true };
      },
    };

    this.members = {
      list: async (bizID: string) => {
        const rows = await this.db.select({ roleMembers: authzRoles.roleMembers })
          .from(authzRoles).where(eq(authzRoles.bizID, bizID)).limit(1);
        if (rows.length === 0 || !rows[0].roleMembers) return [];
        return rows[0].roleMembers;
      },

      add: async (bizID: string, dto: any) => {
        const input = dto.members ?? dto;
        const rm = buildRoleMembersFromInput(input);
        await this.db.update(authzRoles)
          .set({ roleMembers: sql`${JSON.stringify(rm)}::jsonb` })
          .where(eq(authzRoles.bizID, bizID));
        return { success: true };
      },

      remove: async (bizID: string, dto: any) => {
        const current = await this.members.list(bizID, {});
        const rm: RoleMembersData = (current as RoleMembersData) ?? {};
        const toRemove = dto.members?.members ?? dto.members ?? [];
        const removeIds = new Set(
          (Array.isArray(toRemove) ? toRemove : [])
            .map((m: any) => m.userId || m.userID)
            .filter(Boolean),
        );
        if (rm.userList && removeIds.size > 0) {
          rm.userList = rm.userList.filter((u: any) => !removeIds.has(u.userID || u.userId));
        }
        await this.db.update(authzRoles)
          .set({ roleMembers: sql`${JSON.stringify(rm)}::jsonb` })
          .where(eq(authzRoles.bizID, bizID));
        return { success: true };
      },

      clear: async (bizID: string) => {
        await this.db.update(authzRoles)
          .set({ roleMembers: sql`'{}'::jsonb` })
          .where(eq(authzRoles.bizID, bizID));
        return { success: true };
      },
    };

    this.search = {
      search: async (dto: any) => {
        const keyword = dto.query?.trim();
        if (!keyword) return { items: [], total: 0 };

        const rows = await this.db
          .select({ roleMembers: authzRoles.roleMembers })
          .from(authzRoles);

        const userMap = new Map<string, any>();
        for (const row of rows) {
          const rm = row.roleMembers as RoleMembersData | null;
          if (!rm?.userList) continue;
          for (const u of rm.userList) {
            const id = u.userID || u.userId;
            if (!id) continue;
            if (!userMap.has(id)) {
              userMap.set(id, {
                userId: id,
                userName: u.name?.zh_cn || u.userName || u.name || id,
              });
            }
          }
        }

        const lowerKw = keyword.toLowerCase();
        const filtered = [...userMap.values()].filter(
          (u) => u.userName.toLowerCase().includes(lowerKw) || u.userId.toLowerCase().includes(lowerKw),
        );

        const page = dto.page ?? 1;
        const pageSize = dto.pageSize ?? 20;
        const start = (page - 1) * pageSize;
        return { items: filtered.slice(start, start + pageSize), total: filtered.length };
      },
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
