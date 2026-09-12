import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Boxes, Trash2 } from 'lucide-react';
import type { ModelItem } from '@shared/api.interface';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface ModelListPanelProps {
  models: ModelItem[];
  loading: boolean;
  selectedId: string | null;
  onNew: () => void;
  onSelect: (model: ModelItem) => void;
  onDelete: (id: string) => Promise<void>;
}

const ModelListPanel: React.FC<ModelListPanelProps> = ({
  models,
  loading,
  selectedId,
  onNew,
  onSelect,
  onDelete,
}) => {
  const [pendingDelete, setPendingDelete] = useState<ModelItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setPendingDelete(null);
    try {
      await onDelete(pendingDelete.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <span className="text-sm font-bold tracking-tight text-foreground">模型列表</span>
        <Button size="sm" variant="default" className="rounded-full" onClick={onNew} data-ai-section-type="button">
          <Plus className="size-3.5" />
          新建
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading && models.length === 0 ? (
            <div className="px-2 py-8 text-center text-xs text-muted-foreground">
              加载中...
            </div>
          ) : models.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-2 py-12 text-center">
              <Boxes className="size-8 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">暂无模型，点击新建创建</span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {models.map((model) => {
                const isActive = model.id === selectedId;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => onSelect(model)}
                    className={[
                      'flex flex-col items-start gap-1 rounded-2xl border border-transparent px-2.5 py-2 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent',
                    ].join(' ')}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span
                        className={[
                          'truncate text-sm font-medium',
                          isActive ? 'text-primary' : 'text-foreground',
                        ].join(' ')}
                      >
                        {model.model_name}
                      </span>
                      <Trash2
                        className="size-3.5 shrink-0 text-muted-foreground/50 hover:text-destructive cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(model);
                        }}
                      />
                    </div>
                    <div className="flex w-full items-center gap-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {model.model_id}
                      </span>
                      {model.status === 'published' ? (
                        <Badge
                          variant="default"
                          className="ml-auto px-1.5 py-0 text-[10px]"
                        >
                          已发布
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="ml-auto px-1.5 py-0 text-[10px] text-muted-foreground"
                        >
                          草稿
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除模型</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && <>确定要删除模型「{pendingDelete.model_name}」吗？此操作不可恢复。</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">取消</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleConfirmDelete()}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ModelListPanel;
