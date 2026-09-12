import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle2, XCircle, RefreshCw, Loader2, FileCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { axiosForBackend } from '@client/src/common/platform/axios-instance';
import { logger } from '@client/src/common/platform/logger';
import type { ArchiveDomain } from '@shared/api.interface';

interface BatchItem {
  batchId: string;
  batchName: string;
  count: number;
  archiveTime: string;
  status: string;
  reviewRemark: string | null;
  reviewTime: string | null;
}

const STATUS_LABELS: Record<string, { label: string; icon: typeof Clock; className: string; badgeClassName: string }> = {
  pending_review: {
    label: '审核中',
    icon: Clock,
    className: 'text-yellow-600',
    badgeClassName: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  },
  approved: {
    label: '已通过',
    icon: CheckCircle2,
    className: 'text-success',
    badgeClassName: 'bg-success/15 text-success hover:bg-success/15',
  },
  rejected: {
    label: '已驳回',
    icon: XCircle,
    className: 'text-destructive',
    badgeClassName: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
  },
};

interface SubmissionStatusCardProps {
  refreshKey: number;
  domain: ArchiveDomain;
}

const SubmissionStatusCard = ({ refreshKey, domain }: SubmissionStatusCardProps) => {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBatches = useCallback(async (targetDomain: ArchiveDomain) => {
    setLoading(true);
    try {
      const res = await axiosForBackend<BatchItem[]>({
        url: '/api/contracts/archives/batches',
        method: 'GET',
        params: { domain: targetDomain },
      });
      setBatches(res.data);
    } catch (err) {
      logger.error('加载提交状态失败:', JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBatches(domain);
  }, [refreshKey, domain, loadBatches]);

  const pendingCount = batches.filter((b) => b.status === 'pending_review').length;
  const approvedCount = batches.filter((b) => b.status === 'approved').length;
  const rejectedCount = batches.filter((b) => b.status === 'rejected').length;
  const recentBatches = batches.slice(0, 5);

  if (batches.length === 0 && !loading) return null;

  const formatTime = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCheck className="size-5 text-primary" />
          <span className="font-bold tracking-tight">提交状态</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full"
          onClick={() => void loadBatches(domain)}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 py-3">
        <div className="rounded-2xl bg-yellow-50 px-3 py-2 text-center">
          <div className="font-mono text-xl font-bold text-yellow-700">{pendingCount}</div>
          <div className="text-[10px] font-medium text-yellow-600">审核中</div>
        </div>
        <div className="rounded-2xl bg-success/10 px-3 py-2 text-center">
          <div className="font-mono text-xl font-bold text-success">{approvedCount}</div>
          <div className="text-[10px] font-medium text-success">已通过</div>
        </div>
        <div className="rounded-2xl bg-destructive/5 px-3 py-2 text-center">
          <div className="font-mono text-xl font-bold text-destructive">{rejectedCount}</div>
          <div className="text-[10px] font-medium text-destructive">已驳回</div>
        </div>
      </div>

      {loading && batches.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {recentBatches.map((batch) => {
            const cfg = STATUS_LABELS[batch.status] ?? STATUS_LABELS.pending_review;
            const Icon = cfg.icon;
            return (
              <div
                key={batch.batchId}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Icon className={`size-4 shrink-0 ${cfg.className}`} />
                  <span className="truncate text-sm font-medium">{batch.batchName}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {batch.count} 条
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {batch.status === 'rejected' && batch.reviewRemark && (
                    <span
                      className="max-w-[180px] truncate text-xs text-destructive"
                      title={batch.reviewRemark}
                    >
                      {batch.reviewRemark}
                    </span>
                  )}
                  <Badge
                    variant="secondary"
                    className={`rounded-full text-xs ${cfg.badgeClassName}`}
                  >
                    {cfg.label}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatTime(batch.reviewTime || batch.archiveTime)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubmissionStatusCard;
