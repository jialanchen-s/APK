import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Clock,
  FileCheck,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { logger } from '@client/src/common/platform/logger';
import { getPendingReviews, approveBatch, rejectBatch, getBatchDetail } from '@/api/contract';
import type { ContractReviewBatch, ContractReviewDetailItem, ArchiveDomain } from '@shared/api.interface';

const DETAIL_PAGE_SIZE = 10;

interface ContractReviewPanelProps {
  domain: ArchiveDomain;
}

const ContractReviewPanel = ({ domain }: ContractReviewPanelProps) => {
  const [batches, setBatches] = useState<ContractReviewBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ContractReviewBatch | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');
  const [detailBatch, setDetailBatch] = useState<ContractReviewBatch | null>(null);
  const [detailItems, setDetailItems] = useState<ContractReviewDetailItem[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadPending = useCallback(async (targetDomain: ArchiveDomain) => {
    setLoading(true);
    try {
      const res = await getPendingReviews(targetDomain);
      setBatches(res.batches);
    } catch (err) {
      logger.error('加载待审核列表失败:', JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending(domain);
    setDetailBatch(null);
  }, [domain, loadPending]);

  const loadDetail = useCallback(async (batchId: string, page: number, targetDomain: ArchiveDomain) => {
    setDetailLoading(true);
    try {
      const res = await getBatchDetail(batchId, page, DETAIL_PAGE_SIZE, targetDomain);
      setDetailItems(res.items);
      setDetailTotal(res.total);
    } catch (err) {
      logger.error('加载批次明细失败:', JSON.stringify(err));
      toast.error('加载合同明细失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleViewDetail = (batch: ContractReviewBatch) => {
    setDetailBatch(batch);
    setDetailPage(1);
    void loadDetail(batch.batchId, 1, domain);
  };

  const handleApprove = async (batch: ContractReviewBatch) => {
    setActionLoading(`approve-${batch.batchId}`);
    try {
      const res = await approveBatch({ batchId: batch.batchId, domain });
      if (res.affectedCount > 0) {
        toast.success(`已通过审核，共 ${res.affectedCount} 条合同入库生效`);
      } else {
        toast.info('该批次已不在待审核状态');
      }
      await loadPending(domain);
      if (detailBatch?.batchId === batch.batchId) {
        setDetailBatch(null);
      }
    } catch (err) {
      logger.error('审核通过失败:', JSON.stringify(err));
      toast.error('审核操作失败，请重试');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(`reject-${rejectTarget.batchId}`);
    try {
      const res = await rejectBatch({
        batchId: rejectTarget.batchId,
        remark: rejectRemark || undefined,
        domain,
      });
      if (res.affectedCount > 0) {
        toast.success(`已驳回，共 ${res.affectedCount} 条合同未通过审核`);
      } else {
        toast.info('该批次已不在待审核状态');
      }
      await loadPending(domain);
      if (detailBatch?.batchId === rejectTarget.batchId) {
        setDetailBatch(null);
      }
    } catch (err) {
      logger.error('驳回失败:', JSON.stringify(err));
      toast.error('驳回操作失败，请重试');
    } finally {
      setActionLoading(null);
      setRejectTarget(null);
      setRejectRemark('');
    }
  };

  const totalDetailPages = detailTotal > 0 ? Math.ceil(detailTotal / DETAIL_PAGE_SIZE) : 1;

  if (loading && batches.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border border-gray-100 bg-card px-4 py-6 shadow-sm">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载待审核列表...</span>
      </div>
    );
  }

  if (batches.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-gray-100 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCheck className="size-5 text-primary" />
          <span className="font-bold tracking-tight">待审核合同</span>
          <Badge variant="secondary" className="rounded-full">
            {batches.length} 批次
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full"
          onClick={() => void loadPending(domain)}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <div className="divide-y divide-gray-50">
        {batches.map((batch) => (
          <div
            key={batch.batchId}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-gray-50/50"
          >
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{batch.batchName}</span>
                {batch.lineType && (
                  <Badge variant="outline" className="shrink-0 rounded-full text-xs">
                    {batch.lineType}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{batch.count} 条</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {batch.submitTime ? new Date(batch.submitTime).toLocaleString('zh-CN') : '-'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full gap-1"
                onClick={() => handleViewDetail(batch)}
              >
                <Eye className="size-3.5" />
                查看合同
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-full gap-1"
                onClick={() => handleApprove(batch)}
                disabled={actionLoading !== null}
              >
                {actionLoading === `approve-${batch.batchId}` ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                通过
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full gap-1 text-destructive hover:bg-destructive/10"
                onClick={() => setRejectTarget(batch)}
                disabled={actionLoading !== null}
              >
                <XCircle className="size-3.5" />
                驳回
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={!!detailBatch}
        onOpenChange={(open) => {
          if (!open) {
            setDetailBatch(null);
            setDetailItems([]);
            setDetailTotal(0);
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col rounded-3xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 font-bold tracking-tight">
              <FileCheck className="size-5 text-primary" />
              {detailBatch?.batchName}
              <Badge variant="secondary" className="rounded-full font-normal">
                共 {detailTotal} 条合同
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {detailBatch?.lineType && `线别：${detailBatch.lineType}`}
              {detailBatch?.submitTime && ` · 提交时间：${new Date(detailBatch.submitTime).toLocaleString('zh-CN')}`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden -mx-6">
            {detailLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="h-full overflow-auto px-6">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="text-xs font-bold">项目</TableHead>
                      <TableHead className="text-xs font-bold">设备/材料名称</TableHead>
                      <TableHead className="text-xs font-bold">供货</TableHead>
                      <TableHead className="text-xs font-bold text-right">单价(元)</TableHead>
                      <TableHead className="text-xs font-bold">口径</TableHead>
                      <TableHead className="text-xs font-bold">单位</TableHead>
                      <TableHead className="text-xs font-bold text-right">数量</TableHead>
                      <TableHead className="text-xs font-bold">品牌</TableHead>
                      <TableHead className="text-xs font-bold">结算日</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs max-w-[100px] truncate">
                          {item.project || '-'}
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">
                          {item.device_material_name}
                        </TableCell>
                        <TableCell className="text-xs">{item.supply || '-'}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {item.unit_price?.toFixed(2) ?? '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.price_caliber}
                        </TableCell>
                        <TableCell className="text-xs">{item.unit || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {item.quantity ?? '-'}
                        </TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate">
                          {item.selected_brand || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.settle_date?.slice(0, 7) || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 shrink-0">
            <span className="text-xs text-muted-foreground">
              第 {(detailPage - 1) * DETAIL_PAGE_SIZE + 1}-
              {Math.min(detailPage * DETAIL_PAGE_SIZE, detailTotal)} 条，共 {detailTotal} 条
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-8"
                disabled={detailPage <= 1}
                onClick={() => {
                  const next = detailPage - 1;
                  setDetailPage(next);
                  if (detailBatch) void loadDetail(detailBatch.batchId, next, domain);
                }}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                {detailPage} / {totalDetailPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-8"
                disabled={detailPage >= totalDetailPages}
                onClick={() => {
                  const next = detailPage + 1;
                  setDetailPage(next);
                  if (detailBatch) void loadDetail(detailBatch.batchId, next, domain);
                }}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setDetailBatch(null);
                setDetailItems([]);
                setDetailTotal(0);
              }}
            >
              关闭
            </Button>
            <Button
              variant="outline"
              className="rounded-full text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (detailBatch) setRejectTarget(detailBatch);
              }}
              disabled={actionLoading !== null}
            >
              <XCircle className="size-4" />
              驳回
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                if (detailBatch) void handleApprove(detailBatch);
              }}
              disabled={actionLoading !== null}
            >
              {actionLoading?.startsWith('approve-') ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              通过审核
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectRemark(''); } }}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold tracking-tight">
              <XCircle className="size-5 text-destructive" />
              驳回审核
            </DialogTitle>
            <DialogDescription>
              确认驳回批次「{rejectTarget?.batchName}」？驳回后该批次 {rejectTarget?.count} 条合同将不会生效。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">驳回原因（可选）</label>
            <Textarea
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
              placeholder="请输入驳回原因..."
              className="rounded-2xl min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => { setRejectTarget(null); setRejectRemark(''); }}>
              取消
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleConfirmReject}
              disabled={actionLoading !== null}
            >
              {actionLoading?.startsWith('reject-') && <Loader2 className="size-4 animate-spin" />}
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractReviewPanel;
