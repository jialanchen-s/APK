import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Button } from '@/components/ui/button';
import type { PendingItem } from '@shared/api.interface';
import {
  getLatestTask,
  applyModel,
  submitPendingItems,
  getPendingGroups,
} from '@client/src/api/pending-item';
import { useBatchFill } from './use-batch-fill';
import GroupSidebar from './GroupSidebar';
import FillTable from './FillTable';
import ModelSelectDialog from './ModelSelectDialog';

const BatchFill: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTaskId = searchParams.get('taskId');

  const [taskId, setTaskId] = useState<string | null>(urlTaskId);
  const [loadingTask, setLoadingTask] = useState(!urlTaskId);
  const [editValues, setEditValues] = useState<
    Record<string, Record<string, string>>
  >({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applyFlash, setApplyFlash] = useState<Set<string>>(new Set());
  const [showCheck, setShowCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);

  const { groups, selectedGroup, setSelectedGroup, items, loading, loadItems } =
    useBatchFill(taskId);

  // Resolve taskId from URL or fall back to latest estimate task
  useEffect(() => {
    if (urlTaskId) {
      setTaskId(urlTaskId);
      setLoadingTask(false);
      return;
    }
    getLatestTask()
      .then(async (task) => {
        if (task) {
          // Check if task still has pending items
          try {
            const groupsRes = await getPendingGroups(task.id);
            const hasPendingItems = groupsRes.groups.some((g) => g.count > 0);
            if (hasPendingItems) {
              setTaskId(task.id);
            } else {
              setTaskId(null);
            }
          } catch {
            setTaskId(null);
          }
        }
      })
      .catch((err) => logger.error('获取最近任务失败:', JSON.stringify(err)))
      .finally(() => setLoadingTask(false));
  }, [urlTaskId]);

  // Clear edit state when group changes
  useEffect(() => {
    setEditValues({});
    setSelectedIds(new Set());
  }, [selectedGroup]);

  // Listen for estimate-task-reset event (triggered when user clicks "重新测算")
  useEffect(() => {
    const handleReset = () => {
      setTaskId(null);
      setEditValues({});
      setSelectedIds(new Set());
      setLoadingTask(false);
    };
    window.addEventListener('estimate-task-reset', handleReset);
    return () => {
      window.removeEventListener('estimate-task-reset', handleReset);
    };
  }, []);

  const handleEditValue = (
    itemId: string,
    paramName: string,
    value: string,
  ) => {
    setEditValues((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), [paramName]: value },
    }));
  };

  const handleToggleSelect = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (
        items.length > 0 &&
        items.every((i: PendingItem) => prev.has(i.id))
      ) {
        return new Set();
      }
      return new Set(items.map((i: PendingItem) => i.id));
    });
  };

  const handleAIExtract = (
    itemId: string,
    extractedParams: Record<string, string>,
  ) => {
    setEditValues((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), ...extractedParams },
    }));
  };

  const handleOpenModelSelect = () => {
    if (selectedIds.size < 1) return;
    setModelSelectOpen(true);
  };

  const handleApplyModel = async (
    modelId: string,
    paramValues: Record<string, string>,
  ) => {
    if (!taskId || selectedIds.size === 0) return;
    setModelLoading(true);
    try {
      const res = await applyModel({
        taskId,
        itemIds: Array.from(selectedIds),
        modelId,
        paramValues,
      });
      if (res.success) {
        toast.success(`已为 ${res.appliedCount} 项设备应用模型`);
        setModelSelectOpen(false);
        setApplyFlash(new Set(selectedIds));
        setShowCheck(true);
        setTimeout(() => {
          setApplyFlash(new Set());
          setShowCheck(false);
        }, 1500);
        setEditValues((prev) => {
          const next = { ...prev };
          for (const id of selectedIds) delete next[id];
          return next;
        });
        loadItems();
      }
    } catch (err) {
      logger.error('应用模型失败:', JSON.stringify(err));
      toast.error('应用模型失败，请重试');
    } finally {
      setModelLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!taskId || submitting) return;
    setSubmitting(true);
    try {
      const submitItems = items.map((item: PendingItem) => {
        const paramDefaults: Record<string, string> = {};
        for (const p of item.params) {
          if (p.value !== undefined && p.value !== null && p.value !== '') {
            paramDefaults[p.name] = String(p.value);
          }
        }
        const values: Record<string, string> = {
          ...paramDefaults,
          ...Object.fromEntries(
            Object.entries(item.filled_values ?? {}).map(
              ([k, v]) => [k, String(v)] as [string, string],
            ),
          ),
          ...(editValues[item.id] ?? {}),
        };
        return { id: item.id, params: values };
      });
      await submitPendingItems({ taskId, items: submitItems });
      toast.success('提交成功，主成果已更新');
      // Notify EstimateWorkbench to refresh data
      window.dispatchEvent(new CustomEvent('estimate-task-updated', { detail: { taskId } }));
      // Clear local state to show empty state
      setTaskId(null);
      setEditValues({});
      setSelectedIds(new Set());
      navigate('/');
    } catch (err) {
      logger.error('提交失败:', JSON.stringify(err));
      toast.error('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTask) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        加载任务中...
      </div>
    );
  }

  const activeModelId = items.length > 0 ? (items[0].model_id ?? null) : null;

  if (!taskId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        暂无测算任务
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main content: sidebar + table */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-[200px] shrink-0 border-r border-gray-100 bg-card shadow-sm flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <h2 className="text-sm font-bold tracking-tight text-foreground">待处理分组</h2>
          </div>
          <GroupSidebar
            groups={groups}
            selectedGroup={selectedGroup}
            onSelect={setSelectedGroup}
          />
        </aside>

        {/* Right table area */}
        <div className="flex-1 overflow-auto p-4">
          <FillTable
            items={items}
            loading={loading}
            editValues={editValues}
            onEditValue={handleEditValue}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onApplyModel={handleOpenModelSelect}
            onAIExtract={handleAIExtract}
            applyFlash={applyFlash}
            showCheck={showCheck}
            activeModelId={activeModelId}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-gray-100 bg-card shadow-sm px-4 py-3 flex items-center justify-end gap-3">
        <span className="text-sm text-muted-foreground tabular-nums">
          共 {items.length} 项待处理
        </span>
        <Button
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          className="gap-1.5 rounded-full"
        >
          {submitting ? '提交中...' : '提交合并'}
        </Button>
      </div>

      <ModelSelectDialog
        open={modelSelectOpen}
        onOpenChange={setModelSelectOpen}
        onSelect={handleApplyModel}
        loading={modelLoading}
      />
    </div>
  );
};

export default BatchFill;
