import React, { useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Checkbox } from '@client/src/components/ui/checkbox';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@client/src/components/ui/accordion';
import type {
  ForceRoleDTO,
  PermissionPoint,
  RolePermissionMapping,
} from '@shared/api.interface';
import { batchUpdateRoleMappings } from '@client/src/api/permission';

interface ConfigPermissionsDialogProps {
  role: ForceRoleDTO | null;
  permissions: PermissionPoint[];
  mappings: RolePermissionMapping[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const SUBJECT_LABELS: Record<string, string> = {
  Permission: '权限管理',
  PriceQuery: '价格查询',
  ContractArchive: '合同归档',
  EstimateTask: '测算任务',
  PendingItem: '待填项',
  Model: '模型管理',
  Agent: 'AI助手',
};

interface SubjectGroup {
  subject: string;
  label: string;
  items: PermissionPoint[];
}

const ConfigPermissionsDialog: React.FC<ConfigPermissionsDialogProps> = ({
  role,
  permissions,
  mappings,
  open,
  onOpenChange,
  onRefresh,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<boolean>(false);

  const rolePermIds = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    const key = role?.bizID;
    if (!key) return set;
    for (const m of mappings) {
      if (m.roleKey === key) set.add(m.permissionId);
    }
    return set;
  }, [role, mappings]);

  useEffect(() => {
    if (!open || !role) return;
    setSelectedIds(new Set(rolePermIds));
    setInitialIds(new Set(rolePermIds));
  }, [open, role, rolePermIds]);

  const groups = useMemo<SubjectGroup[]>(() => {
    const map = new Map<string, PermissionPoint[]>();
    for (const p of permissions) {
      const arr = map.get(p.subject) ?? [];
      arr.push(p);
      map.set(p.subject, arr);
    }
    const result: SubjectGroup[] = [];
    for (const [subject, items] of map) {
      result.push({
        subject,
        label: SUBJECT_LABELS[subject] ?? subject,
        items,
      });
    }
    return result;
  }, [permissions]);

  const defaultExpanded = useMemo<string[]>(() => {
    return groups
      .filter((g: SubjectGroup) =>
        g.items.some((p: PermissionPoint) => rolePermIds.has(p.id)),
      )
      .map((g: SubjectGroup) => g.subject);
  }, [groups, rolePermIds]);

  const togglePermission = (id: string): void => {
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async (): Promise<void> => {
    const roleKey = role?.bizID;
    if (!roleKey) return;
    const add: string[] = [];
    const remove: string[] = [];
    for (const id of selectedIds) {
      if (!initialIds.has(id)) add.push(id);
    }
    for (const id of initialIds) {
      if (!selectedIds.has(id)) remove.push(id);
    }
    if (add.length === 0 && remove.length === 0) {
      toast.info('权限无变更');
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await batchUpdateRoleMappings({ roleKey, add, remove });
      toast.success('权限配置已保存');
      onRefresh();
      onOpenChange(false);
    } catch {
      toast.error('权限配置失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>配置权限 · {role?.name ?? ''}</DialogTitle>
          <DialogDescription>
            为角色配置可操作的权限点位，按模块分组展示。
          </DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={defaultExpanded} className="w-full">
          {groups.map((g: SubjectGroup) => {
            const enabledCount = g.items.filter((p: PermissionPoint) =>
              selectedIds.has(p.id),
            ).length;
            return (
              <AccordionItem key={g.subject} value={g.subject}>
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <span className="font-bold tracking-tight">{g.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      ({enabledCount}/{g.items.length})
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2">
                    {g.items.map((p: PermissionPoint) => {
                      const checked = selectedIds.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-100 px-3 py-2 hover:bg-accent/40"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePermission(p.id)}
                            className="mt-0.5"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">{p.description}</span>
                            <code className="text-[11px] text-muted-foreground">
                              {p.action}:{p.subject}
                            </code>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

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

export default ConfigPermissionsDialog;
