import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Loader2, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EstimateTask } from '@shared/api.interface';

interface ProgressSectionProps {
  task: EstimateTask | null;
}

interface Step {
  id: string;
  label: string;
  detail?: string;
}

const STEPS: Step[] = [
  { id: 'parse', label: '解析清单 + 多维标签提取', detail: '' },
  { id: 'estimate', label: '甲供记0 + 历史库寻价 + 改造轨道A 自动算完', detail: '' },
  { id: 'pending', label: '收集需人工填参数 / 无据挂起行', detail: '进入批量填报' },
];

const ProgressSection = ({ task }: ProgressSectionProps) => {
  if (!task || task.status === 'success' || task.status === 'failed') return null;

  // 基于 total_rows 估算进度（已处理 = success + jia_gong + pending）
  const processed =
    task.success_rows + task.jia_gong_rows + task.pending_rows;
  const total = task.total_rows || 1;
  const percent = Math.min(99, Math.round((processed / total) * 100));

  // 根据进度确定当前步骤状态
  const getStepStatus = (stepIndex: number) => {
    if (percent >= 90) {
      // 最后一步或完成
      return stepIndex === 2 ? 'current' : 'completed';
    }
    if (percent >= 50) {
      // 中间步骤
      if (stepIndex === 0) return 'completed';
      if (stepIndex === 1) return 'current';
      return 'pending';
    }
    // 刚开始
    if (stepIndex === 0) return 'current';
    return 'pending';
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5">
          {/* 标题 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">
              阶段1 · 自动测算进度（静默，无弹窗）
            </h3>
            <span className="text-sm tabular-nums text-primary font-medium">
              {percent}%
            </span>
          </div>

          {/* 进度条 */}
          <div className="mb-5">
            <Progress value={percent} className="h-2.5 rounded-full" />
          </div>

          {/* 步骤列表 */}
          <div className="space-y-3">
            {STEPS.map((step, index) => {
              const status = getStepStatus(index);
              return (
                <div key={step.id} className="flex items-start gap-3">
                  {/* 步骤图标 */}
                  <div className="flex shrink-0 mt-0.5">
                    {status === 'completed' ? (
                      <div className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <Check className="size-4" />
                      </div>
                    ) : status === 'current' ? (
                      <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                      </div>
                    ) : (
                      <div className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Circle className="size-3.5" />
                      </div>
                    )}
                  </div>

                  {/* 步骤文字 */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm leading-relaxed',
                        status === 'completed'
                          ? 'text-foreground'
                          : status === 'current'
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                      {index === 0 && task.total_rows > 0 && (
                        <span className="ml-1 text-muted-foreground">
                          （{task.total_rows} 行）
                        </span>
                      )}
                      {index === 2 && task.pending_rows > 0 && (
                        <span className="ml-1 text-amber-600">
                          → {task.pending_rows} 行待处理
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ProgressSection;
