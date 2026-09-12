import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import UploadZone from './UploadZone';
import ProgressSection from './ProgressSection';
import StatCards from './StatCards';
import ResultTable from './ResultTable';
import DownloadSection from './DownloadSection';
import AnomalyCard from './AnomalyCard';
import { useTaskPolling } from './use-task-polling';
import { getEstimateTaskItems, getAnomalyResult } from '@client/src/api/estimate-task';
import { resetTaskPendingItems } from '@client/src/api/pending-item';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  EstimateTaskItem,
  EstimateItemFilter,
} from '@shared/api.interface';
import { Calculator, RotateCcw, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AnomalyDetectionResult } from '@shared/api.interface';

const PAGE_SIZE = 10;

const STORAGE_KEY = 'estimate_task_id';

const EstimateWorkbench = () => {
  const [taskId, setTaskId] = useState<string | null>(() => {
    // Restore from sessionStorage on initial load
    return sessionStorage.getItem(STORAGE_KEY);
  });
  const { task } = useTaskPolling(taskId);

  const [filter, setFilter] = useState<EstimateItemFilter>('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<EstimateTaskItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [anomalyResult, setAnomalyResult] = useState<AnomalyDetectionResult | null>(null);

  const isCompleted = task?.status === 'success';

  // 测算完成后加载明细列表
  const loadItems = useCallback(async () => {
    if (!taskId || !isCompleted) return;
    setItemsLoading(true);
    try {
      const res = await getEstimateTaskItems(taskId, page, PAGE_SIZE, filter);
      setItems(res.items);
      setItemsTotal(res.total);
    } catch (err) {
      logger.error('加载明细列表失败:', JSON.stringify(err));
    } finally {
      setItemsLoading(false);
    }
  }, [taskId, isCompleted, page, filter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Listen for batch fill submission to refresh data
  useEffect(() => {
    const handleTaskUpdated = (e: CustomEvent<{ taskId: string }>) => {
      if (e.detail.taskId === taskId) {
        loadItems();
      }
    };
    window.addEventListener('estimate-task-updated', handleTaskUpdated as EventListener);
    return () => {
      window.removeEventListener('estimate-task-updated', handleTaskUpdated as EventListener);
    };
  }, [taskId, loadItems]);

  // 测算完成后延迟获取异常检测结果（异步检测可能需要几秒）
  useEffect(() => {
    if (!isCompleted || !taskId) return;
    setAnomalyResult(task?.anomaly_result ?? null);
    if (task?.anomaly_result) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(async () => {
      if (cancelled || attempts >= maxAttempts) {
        clearInterval(interval);
        return;
      }
      attempts++;
      try {
        const result = await getAnomalyResult(taskId);
        if (result) {
          setAnomalyResult(result);
          clearInterval(interval);
        }
      } catch (err) {
        logger.error('获取异常检测结果失败:', JSON.stringify(err));
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isCompleted, taskId, task?.anomaly_result]);

  const handleTaskCreated = (id: string) => {
    setTaskId(id);
    sessionStorage.setItem(STORAGE_KEY, id);
    setPage(1);
    setFilter('all');
    setItems([]);
    setItemsTotal(0);
  };

  const handleFilterChange = (newFilter: EstimateItemFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleReset = async () => {
    if (taskId) {
      try {
        await resetTaskPendingItems(taskId);
      } catch (err) {
        logger.error('重置待处理项失败:', JSON.stringify(err));
      }
    }
    setTaskId(null);
    sessionStorage.removeItem(STORAGE_KEY);
    setItems([]);
    setItemsTotal(0);
    setFilter('all');
    setPage(1);
    setAnomalyResult(null);
    window.dispatchEvent(new CustomEvent('estimate-task-reset'));
  };

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-5">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Calculator className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              测算工作台
            </h1>
            <p className="text-sm text-muted-foreground">
              上传预算清单，自动瀑布流寻价与智能测算
            </p>
          </div>
        </div>
        {taskId && (
          <Button variant="ghost" size="sm" className="rounded-full" onClick={handleReset}>
            <RotateCcw className="size-4" />
            重新测算
          </Button>
        )}
      </div>

      {/* 上传区 */}
      <UploadZone onTaskCreated={handleTaskCreated} />

      {/* 进度条 */}
      <AnimatePresence>
        {task && task.status === 'processing' && (
          <ProgressSection task={task} />
        )}
      </AnimatePresence>

      {/* 指标卡 */}
      {isCompleted && task && (
        <StatCards
          total={task.total_rows}
          success={task.success_rows}
          jiaGong={task.jia_gong_rows}
          pending={task.pending_rows}
          activeFilter={filter}
          onFilterChange={handleFilterChange}
          taskId={taskId}
        />
      )}

      {/* 异常检测结果 */}
      {isCompleted && anomalyResult && (
        <AnomalyCard result={anomalyResult} />
      )}

      {/* 结果明细列表 */}
      {isCompleted && (
        <div className="space-y-4">
          {/* 标题栏 + 导出按钮 */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight text-foreground">
              主成果表
              {task?.file_name && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({task.file_name.replace(/\.xlsx?$/i, '')})
                </span>
              )}
            </h2>
            <DownloadSection 
              taskId={taskId ?? ''} 
              hasResult={isCompleted} 
              fileName={task?.file_name}
            />
          </div>
          
          <ResultTable
            items={items}
            total={itemsTotal}
            page={page}
            pageSize={PAGE_SIZE}
            loading={itemsLoading}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};

export default EstimateWorkbench;
