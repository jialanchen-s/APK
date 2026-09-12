import React, { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { Table, type TableProps } from '@lark-apaas/client-toolkit/antd-table';

import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@client/src/components/ui/hover-card';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@client/src/components/ui/tooltip';

import RoleMemberSummary from './RoleMemberSummary';
import EditMembersDialog from './EditMembersDialog';
import ConfigPermissionsDialog from './ConfigPermissionsDialog';
import { CreateRoleDialog, EditRoleDialog, DeleteRoleDialog } from './RoleDialogs';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from '@client/src/api/role-manager';
import { listPermissions, listRoleMappings } from '@client/src/api/permission';
import type {
  ForceRoleDTO,
  PermissionPoint,
  RolePermissionMapping,
} from '@shared/api.interface';

type RoleColumns = NonNullable<TableProps<ForceRoleDTO>['columns']>;

const RoleManagementPage: React.FC = () => {
  const [roles, setRoles] = useState<ForceRoleDTO[]>([]);
  const [permissions, setPermissions] = useState<PermissionPoint[]>([]);
  const [mappings, setMappings] = useState<RolePermissionMapping[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [editRoleOpen, setEditRoleOpen] = useState<boolean>(false);
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [membersOpen, setMembersOpen] = useState<boolean>(false);
  const [permissionsOpen, setPermissionsOpen] = useState<boolean>(false);

  const [targetRole, setTargetRole] = useState<ForceRoleDTO | null>(null);
  const [newName, setNewName] = useState<string>('');
  const [newBizID, setNewBizID] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadAll = useCallback(async (showLoading: boolean): Promise<void> => {
    if (showLoading) setLoading(true);
    try {
      const [r, p, m] = await Promise.all([
        getRoles(),
        listPermissions(),
        listRoleMappings(),
      ]);
      setRoles(r);
      setPermissions(p);
      setMappings(m);
    } catch {
      toast.error('加载数据失败，请重试');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll(true);
  }, [loadAll]);

  const refresh = useCallback((): void => {
    void loadAll(false);
  }, [loadAll]);

  const getRolePermissions = (role: ForceRoleDTO): PermissionPoint[] => {
    const ids = new Set(
      mappings
        .filter((m: RolePermissionMapping) => m.roleKey === role.bizID)
        .map((m: RolePermissionMapping) => m.permissionId),
    );
    return permissions.filter((p: PermissionPoint) => ids.has(p.id));
  };

  const openMembers = (role: ForceRoleDTO): void => {
    setTargetRole(role);
    setMembersOpen(true);
  };

  const openPermissions = (role: ForceRoleDTO): void => {
    setTargetRole(role);
    setPermissionsOpen(true);
  };

  const openEditRole = (role: ForceRoleDTO): void => {
    setTargetRole(role);
    setEditName(role.name ?? '');
    setEditDesc(role.description ?? '');
    setEditRoleOpen(true);
  };

  const openDelete = (role: ForceRoleDTO): void => {
    setTargetRole(role);
    setDeleteOpen(true);
  };

  const handleCreate = async (): Promise<void> => {
    const name = newName.trim();
    const bizID = newBizID.trim();
    if (!name || !bizID) return;
    setSubmitting(true);
    try {
      await createRole({ role: { name, bizID, description: newDesc.trim() || undefined } });
      toast.success('角色创建成功');
      setCreateOpen(false);
      setNewName('');
      setNewBizID('');
      setNewDesc('');
      refresh();
    } catch {
      toast.error('角色创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (): Promise<void> => {
    const bizID = targetRole?.bizID;
    if (!bizID) return;
    setSubmitting(true);
    try {
      await updateRole(bizID, { role: { name: editName.trim(), description: editDesc.trim() || undefined } });
      toast.success('角色更新成功');
      setEditRoleOpen(false);
      refresh();
    } catch {
      toast.error('角色更新失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    const bizID = targetRole?.bizID;
    if (!bizID) return;
    setSubmitting(true);
    try {
      await deleteRole(bizID);
      toast.success('角色删除成功');
      setDeleteOpen(false);
      refresh();
    } catch {
      toast.error('角色删除失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: RoleColumns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (_v: unknown, r: ForceRoleDTO) => <span className="font-medium">{r.name ?? '--'}</span>,
    },
    {
      title: '角色描述',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      render: (_v: unknown, r: ForceRoleDTO) => r.description ? <span className="text-sm text-muted-foreground">{r.description}</span> : <span className="text-muted-foreground">--</span>,
    },
    {
      title: '角色标识',
      dataIndex: 'bizID',
      key: 'bizID',
      width: 200,
      render: (_v: unknown, r: ForceRoleDTO) => <span className="font-mono text-xs text-muted-foreground">{r.bizID ?? '--'}</span>,
    },
    {
      title: '权限点位',
      key: 'permissions',
      width: 250,
      render: (_v: unknown, r: ForceRoleDTO) => {
        const rp = getRolePermissions(r);
        if (rp.length === 0) return <span className="text-muted-foreground">--</span>;
        const visible = rp.slice(0, 3);
        const overflow = rp.slice(3);
        return (
          <div className="flex flex-wrap items-center gap-1">
            {visible.map((p: PermissionPoint) => (
              <Badge key={p.id} variant="secondary" className="font-normal">{p.description}</Badge>
            ))}
            {overflow.length > 0 && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Badge variant="outline" className="cursor-pointer">+{overflow.length}</Badge>
                </HoverCardTrigger>
                <HoverCardContent className="w-auto max-w-sm">
                  <div className="flex flex-col gap-1">
                    {overflow.map((p: PermissionPoint) => <span key={p.id} className="text-xs">{p.description}</span>)}
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
        );
      },
    },
    {
      title: '角色成员',
      key: 'members',
      width: 250,
      render: (_v: unknown, r: ForceRoleDTO) => <RoleMemberSummary role={r} />,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_v: unknown, r: ForceRoleDTO) => {
        const isProtected = Boolean(r.roleMembers?.allEmployees) || Boolean(r.roleMembers?.public);
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openMembers(r)}>编辑成员</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openPermissions(r)}><Shield className="size-4" /> 配置权限</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditRole(r)}><Pencil className="size-4" /> 编辑角色信息</DropdownMenuItem>
                {isProtected ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block">
                        <DropdownMenuItem variant="destructive" disabled><Trash2 className="size-4" /> 删除角色</DropdownMenuItem>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>包含企业全员/互联网公开的角色不支持删除</TooltipContent>
                  </Tooltip>
                ) : (
                  <DropdownMenuItem variant="destructive" onClick={() => openDelete(r)}><Trash2 className="size-4" /> 删除角色</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">权限管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">管理角色、成员与权限点位</p>
          </div>
          <Button className="rounded-full bg-primary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> 添加角色
          </Button>
        </div>
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-card shadow-sm">
          <Table<ForceRoleDTO>
            rowKey={(r: ForceRoleDTO) => r.bizID ?? ''}
            columns={columns}
            dataSource={roles}
            pagination={false}
            loading={loading}
            size="middle"
            locale={{ emptyText: '暂无角色' }}
          />
        </div>
      </div>

      <CreateRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        name={newName}
        bizID={newBizID}
        desc={newDesc}
        submitting={submitting}
        onNameChange={setNewName}
        onBizIDChange={setNewBizID}
        onDescChange={setNewDesc}
        onCreate={handleCreate}
      />
      <EditRoleDialog
        open={editRoleOpen}
        onOpenChange={setEditRoleOpen}
        name={editName}
        desc={editDesc}
        submitting={submitting}
        onNameChange={setEditName}
        onDescChange={setEditDesc}
        onUpdate={handleUpdateRole}
      />
      <DeleteRoleDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        roleName={targetRole?.name ?? ''}
        submitting={submitting}
        onDelete={handleDelete}
      />
      <EditMembersDialog role={targetRole} open={membersOpen} onOpenChange={setMembersOpen} onSuccess={refresh} />
      <ConfigPermissionsDialog
        role={targetRole}
        permissions={permissions}
        mappings={mappings}
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        onRefresh={refresh}
      />
    </div>
  );
};

export default RoleManagementPage;
