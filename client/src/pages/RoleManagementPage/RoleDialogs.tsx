import React from 'react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  bizID: string;
  desc: string;
  submitting: boolean;
  onNameChange: (v: string) => void;
  onBizIDChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onCreate: () => void;
}

export const CreateRoleDialog: React.FC<CreateRoleDialogProps> = ({
  open, onOpenChange, name, bizID, desc, submitting,
  onNameChange, onBizIDChange, onDescChange, onCreate,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>添加角色</DialogTitle>
        <DialogDescription>创建一个新的角色，用于分配成员与权限点位。</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">角色名称 <span className="text-destructive">*</span></label>
          <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)} placeholder="请输入角色名称" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">角色标识 <span className="text-destructive">*</span></label>
          <Input value={bizID} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onBizIDChange(e.target.value)} placeholder="snake_case，如 cost_admin" />
          <span className="text-xs text-muted-foreground">建议使用 snake_case 格式</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">角色描述</label>
          <Textarea value={desc} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onDescChange(e.target.value)} placeholder="选填，描述角色职责" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button>
        <Button className="rounded-full bg-primary" onClick={onCreate} disabled={!name.trim() || !bizID.trim() || submitting}>创建</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  desc: string;
  submitting: boolean;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onUpdate: () => void;
}

export const EditRoleDialog: React.FC<EditRoleDialogProps> = ({
  open, onOpenChange, name, desc, submitting,
  onNameChange, onDescChange, onUpdate,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>编辑角色信息</DialogTitle>
        <DialogDescription>修改角色名称与描述。</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">角色名称</label>
          <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)} placeholder="请输入角色名称" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">角色描述</label>
          <Textarea value={desc} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onDescChange(e.target.value)} placeholder="选填，描述角色职责" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button>
        <Button className="rounded-full bg-primary" onClick={onUpdate} disabled={submitting}>保存</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleName: string;
  submitting: boolean;
  onDelete: () => void;
}

export const DeleteRoleDialog: React.FC<DeleteRoleDialogProps> = ({
  open, onOpenChange, roleName, submitting, onDelete,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>删除角色</DialogTitle>
        <DialogDescription>确定要删除角色「{roleName}」吗？此操作不可撤销。</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button>
        <Button variant="destructive" className="rounded-full" onClick={onDelete} disabled={submitting}>删除</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
