import React, { useEffect, useState } from 'react';

import { toast } from 'sonner';
import { Building, Globe, Users } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Switch } from '@client/src/components/ui/switch';
import { UserSelect } from '@client/src/components/business-ui/user-select';
import { DepartmentSelect } from '@client/src/components/business-ui/department-select';
import { ChatSelect } from '@client/src/components/business-ui/chat-select';
import type { Department as DepartmentValue } from '@client/src/components/business-ui/department-select/types';
import type { Chat } from '@client/src/components/business-ui/chat-select/types';
import type {
  ForceRoleDTO,
  UserSimpleDTO,
  DepartmentDTO,
  ChatSimpleDTO,
} from '@shared/api.interface';
import { clearRoleMembers, addRoleMembers } from '@client/src/api/role-manager';

interface EditMembersDialogProps {
  role: ForceRoleDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EditMembersDialog: React.FC<EditMembersDialogProps> = ({
  role,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [userIds, setUserIds] = useState<string[]>([]);
  const [depts, setDepts] = useState<DepartmentValue[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isAdminEnabled, setIsAdminEnabled] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!open || !role) return;
    const rm = role.roleMembers;
    setUserIds(
      (rm?.userList ?? [])
        .map((u: UserSimpleDTO) => u.userID ?? '')
        .filter(Boolean),
    );
    setDepts(
      (rm?.departmentList ?? []).map((d: DepartmentDTO) => ({
        id: d.id ?? '',
        name: d.name?.zh_cn ?? '',
      })),
    );
    setChats(
      (rm?.groupChatList ?? []).map((c: ChatSimpleDTO) => ({
        id: c.chatID ?? '',
        name: c.name?.zh_cn ?? '',
        avatar: c.avatar || '#1456F0',
      })),
    );
    setIsAdminEnabled(Boolean(rm?.presetGroup?.isContainsAdmin));
  }, [open, role]);

  const handleSave = async (): Promise<void> => {
    const bizID = role?.bizID;
    if (!bizID) return;
    setSaving(true);
    try {
      await clearRoleMembers(bizID);
      await addRoleMembers(bizID, {
        members: {
          userList: userIds.map((uid: string) => ({ userID: uid })),
          departmentList: depts.map((d: DepartmentValue) => ({ id: d.id })),
          groupChatList: chats.map((c: Chat) => ({ chatID: c.id })),
          isContainsAdmin: isAdminEnabled,
        },
      });
      toast.success('成员保存成功');
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error('成员保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const rm = role?.roleMembers;
  const hasAllEmployees = Boolean(rm?.allEmployees);
  const hasPublic = Boolean(rm?.public);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑成员 · {role?.name ?? ''}</DialogTitle>
          <DialogDescription>
            配置角色的特殊成员范围与指定成员，保存后将全量替换当前成员。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              特殊成员范围
            </span>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-muted/40 px-3 py-2">
                <span
                  className="flex items-center justify-center rounded-full bg-primary"
                  style={{ width: 20, height: 20 }}
                >
                  <Users className="h-3 w-3 text-primary-foreground" />
                </span>
                <span className="text-sm">应用开发者</span>
                <Switch
                  checked={isAdminEnabled}
                  onCheckedChange={setIsAdminEnabled}
                />
              </div>

              {hasAllEmployees && (
                <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-muted/40 px-3 py-2">
                  <span
                    className="flex items-center justify-center rounded-full bg-primary"
                    style={{ width: 20, height: 20 }}
                  >
                    <Building className="h-3 w-3 text-primary-foreground" />
                  </span>
                  <span className="text-sm">企业全员</span>
                  <Switch checked disabled />
                </div>
              )}

              {hasPublic && (
                <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-muted/40 px-3 py-2">
                  <span
                    className="flex items-center justify-center rounded-full bg-primary"
                    style={{ width: 20, height: 20 }}
                  >
                    <Globe className="h-3 w-3 text-primary-foreground" />
                  </span>
                  <span className="text-sm">互联网公开</span>
                  <Switch checked disabled />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              指定成员
            </span>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">用户</span>
                <UserSelect
                  multiple
                  value={userIds}
                  onChange={(v: string[]) => setUserIds(v)}
                  placeholder="请选择用户"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">部门</span>
                <DepartmentSelect
                  multiple
                  value={depts}
                  onChange={(
                    v: DepartmentValue | DepartmentValue[] | null,
                  ): void => setDepts(Array.isArray(v) ? v : [])}
                  placeholder="请选择部门"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">群组</span>
                <ChatSelect
                  multiple
                  valueType="object"
                  value={chats}
                  onChange={(v: Chat[] | Chat | null): void =>
                    setChats(Array.isArray(v) ? v : v ? [v] : [])
                  }
                  placeholder="请选择群组"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            className="rounded-full bg-primary"
            onClick={handleSave}
            disabled={saving}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditMembersDialog;
