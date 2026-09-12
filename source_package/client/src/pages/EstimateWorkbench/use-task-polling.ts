import { useState, useEffect, useRef, useCallback } from 'react';
import { getEstimateTask } from '@client/src/api/estimate-task';
import type { EstimateTask } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

const POLL_INTERVAL = 2000;

/**
 * 轮询测算任务状态，status 变为 success 时停止并 toast 通知。
 */
export function useTaskPolling(taskId: string | null) {
  const [task, setTask] = useState<EstimateTask | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    setIsPolling(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const poll = useCallback(
    async (id: string) => {
      try {
        const result = await getEstimateTask(id);
        setTask(result);
        if (result.status === 'success') {
          stop();
          toast.success('测算完成', {
            description: `共 ${result.total_rows} 行，成功 ${result.success_rows}，甲供 ${result.jia_gong_rows}，待人工 ${result.pending_rows}`,
          });
        } else if (result.status === 'failed') {
          stop();
          toast.error('测算失败', {
            description: '请检查数据或稍后重试',
          });
        }
      } catch (err) {
        logger.error('轮询任务状态失败:', JSON.stringify(err));
      }
    },
    [stop],
  );

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }
    stoppedRef.current = false;
    setIsPolling(true);
    // 立即查一次
    poll(taskId);
    timerRef.current = setInterval(() => {
      if (!stoppedRef.current) {
        poll(taskId);
      }
    }, POLL_INTERVAL);

    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  return { task, isPolling, stop, setTask };
}
