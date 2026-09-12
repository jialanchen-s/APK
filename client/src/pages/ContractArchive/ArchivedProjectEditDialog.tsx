import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { updateArchiveProject } from '@client/src/api/contract';
import type { ArchiveDomain, ArchiveProjectSummary } from '@shared/api.interface';

interface ArchivedProjectEditDialogProps {
  project: ArchiveProjectSummary | null;
  domain: ArchiveDomain;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const ArchivedProjectEditDialog: React.FC<ArchivedProjectEditDialogProps> = ({
  project,
  domain,
  open,
  onOpenChange,
  onSaved,
}) => {
  const [projectTime, setProjectTime] = useState('');
  const [factoryName, setFactoryName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && project) {
      setProjectTime(project.projectTime ?? '');
      setFactoryName(project.factoryName ?? '');
    }
  }, [open, project]);

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const res = await updateArchiveProject({
        project: project.project,
        domain,
        projectTime,
        factoryName,
      });
      toast.success(`已更新「${project.project}」，共 ${res.updatedCount} 条记录`);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error('更新失败，请重试');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-bold tracking-tight">编辑项目信息</DialogTitle>
          <DialogDescription>
            将更新「{project?.project}」项目下全部 {project?.count ?? 0} 条归档记录的项目时间与工厂名称，留空则清空该字段。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">项目时间</label>
            <Input
              type="text"
              placeholder="如 2026-09-08"
              value={projectTime}
              onChange={(e) => setProjectTime(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">工厂名称</label>
            <Input
              type="text"
              placeholder="如 广州基地"
              value={factoryName}
              onChange={(e) => setFactoryName(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="rounded-full" onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ArchivedProjectEditDialog;
