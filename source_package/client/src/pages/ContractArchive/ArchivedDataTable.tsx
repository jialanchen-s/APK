import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, ChevronLeft, ChevronRight, RefreshCw, Trash2, Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { deleteArchivedContracts } from '@/api/contract';
import { toast } from 'sonner';
import type { PriceQueryResponse, ArchiveCounts, ArchivePeriod } from '@shared/api.interface';
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

const PAGE_SIZE = 10;

interface ArchivedDataTableProps {
  refreshKey: number;
}

interface ArchiveBatch {
  batchId: string;
  batchName: string;
  count: number;
  archiveTime: string;
  status: string;
  reviewRemark: string | null;
  reviewTime: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline'; className: string }> = {
  pending_review: { label: '审核中', variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  approved: { label: '已通过', variant: 'default', className: 'bg-success/15 text-success hover:bg-success/15' },
  rejected: { label: '已驳回', variant: 'destructive', className: '' },
};

type TabType = ArchivePeriod | 'batches';

const ArchivedDataTable = ({ refreshKey }: ArchivedDataTableProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('recent');
  const [archiveCounts, setArchiveCounts] = useState<ArchiveCounts | null>(null);
  const [data, setData] = useState<PriceQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [jumpPage, setJumpPage] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [batches, setBatches] = useState<ArchiveBatch[]>([]);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [pendingDeleteBatch, setPendingDeleteBatch] = useState<ArchiveBatch | null>(null);

  const loadCounts = useCallback(async () => {
    try {
      const res = await axiosForBackend<ArchiveCounts>({
        url: '/api/price-query/archive-counts',
        method: 'GET',
      });
      setArchiveCounts(res.data);
    } catch {
      // silent fail for counts
    }
  }, []);

  const loadData = useCallback(async (pageNum: number, project: string, tab: ArchivePeriod) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        pageSize: String(PAGE_SIZE),
        archive_period: tab,
      });
      if (project) {
        params.append('project', project);
      }
      const res = await axiosForBackend<PriceQueryResponse>({
        url: `/api/price-query/search?${params.toString()}`,
        method: 'GET',
      });
      setData(res.data);
    } catch {
      toast.error('加载已归档数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await axiosForBackend<ArchiveBatch[]>({
        url: '/api/contracts/archives/batches',
        method: 'GET',
      });
      setBatches(res.data);
    } catch {
      toast.error('加载归档批次失败');
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCounts();
  }, [refreshKey, loadCounts]);

  useEffect(() => {
    if (activeTab === 'batches') {
      void loadBatches();
    } else {
      void loadData(page, projectFilter, activeTab);
    }
  }, [page, refreshKey, projectFilter, activeTab, loadData, loadBatches]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [refreshKey, activeTab]);

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(1);
    setProjectFilter('');
    if (tab === 'history') {
      setHistoryLoaded(true);
    }
  };

  const handleDeleteBatch = async () => {
    if (!pendingDeleteBatch) return;
    const { batchId, batchName } = pendingDeleteBatch;
    setDeletingBatchId(batchId);
    setPendingDeleteBatch(null);
    try {
      const res = await axiosForBackend<{ success: boolean; deletedCount: number; batchName?: string }>({
        url: `/api/contracts/archives/batch?batchId=${batchId}`,
        method: 'DELETE',
      });
      toast.success(`已删除批次「${res.data.batchName || batchName}」，共 ${res.data.deletedCount} 条数据`);
      void loadBatches();
      void loadCounts();
    } catch {
      toast.error('删除批次失败');
    } finally {
      setDeletingBatchId(null);
    }
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = async () => {
    if (!data) return;
    if (selectedIds.size === data.total && data.total > 0) {
      setSelectedIds(new Set());
      return;
    }
    setSelectingAll(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: String(data.total),
        archive_period: activeTab as ArchivePeriod,
      });
      if (projectFilter) {
        params.append('project', projectFilter);
      }
      const res = await axiosForBackend<PriceQueryResponse>({
        url: `/api/price-query/search?${params.toString()}`,
        method: 'GET',
      });
      setSelectedIds(new Set(res.data.items.map((i) => i.id)));
    } catch {
      toast.error('全选失败，请稍后重试');
    } finally {
      setSelectingAll(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await deleteArchivedContracts(Array.from(selectedIds));
      toast.success(`已删除 ${res.deletedCount} 条记录`);
      setSelectedIds(new Set());
      await Promise.all([loadCounts(), loadData(page, projectFilter, activeTab as ArchivePeriod)]);
    } catch {
      toast.error('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  const handleRefresh = () => {
    void loadCounts();
    if (activeTab === 'batches') {
      void loadBatches();
    } else {
      void loadData(page, projectFilter, activeTab as ArchivePeriod);
    }
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <Card className="rounded-3xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="size-4 text-primary" />
          <span className="text-base font-bold tracking-tight">已归档数据</span>
          <div className="ml-2 flex items-center gap-1 rounded-full bg-muted p-0.5">
            <button
              type="button"
              onClick={() => handleTabChange('recent')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activeTab === 'recent'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              近期归档
              {archiveCounts && (
                <span className={`ml-1 ${activeTab === 'recent' ? 'text-primary' : ''}`}>
                  ({archiveCounts.recent})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('history')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              远期归档
              {archiveCounts && (
                <span className={`ml-1 ${activeTab === 'history' ? 'text-primary' : ''}`}>
                  ({archiveCounts.history})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('batches')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activeTab === 'batches'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className="inline size-3 mr-1" />
              批次管理
            </button>
          </div>
          {activeTab !== 'batches' && data && (
            <span className="text-sm font-normal text-muted-foreground">
              （当前 {data.total} 条）
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
           {activeTab === 'batches' && (
             <div className="relative">
               <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
               <Input
                 type="text"
                 placeholder="搜索批次名称..."
                 value={batchSearch}
                 onChange={(e) => setBatchSearch(e.target.value)}
                 className="h-8 w-48 rounded-full pl-9 text-sm"
               />
             </div>
           )}
           {activeTab !== 'batches' && (
             <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="筛选项目..."
                  value={projectFilter}
                  onChange={(e) => {
                    setProjectFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-40 rounded-full pl-9 text-sm"
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={handleRefresh}
              disabled={loading || batchesLoading}
            >
              <RefreshCw className={`size-3.5 ${loading || batchesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeTab === 'batches' ? (
          batchesLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">加载中...</p>
          ) : batches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无归档批次</p>
           ) : (
             <div className="max-h-[420px] overflow-y-auto">
               <Table>
                 <TableHeader className="sticky top-0 bg-background z-10">
                   <TableRow>
                     <TableHead className="text-xs font-bold">批次名称</TableHead>
                     <TableHead className="text-xs font-bold text-right">数据条数</TableHead>
                     <TableHead className="text-xs font-bold">状态</TableHead>
                     <TableHead className="text-xs font-bold">归档时间</TableHead>
                     <TableHead className="text-xs font-bold text-center">操作</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {batches
                     .filter((b) =>
                       !batchSearch || b.batchName.toLowerCase().includes(batchSearch.toLowerCase()),
                     )
                     .map((batch) => (
                  <TableRow key={batch.batchId}>
                    <TableCell className="font-medium text-sm">
                      <Package className="inline size-3.5 mr-1.5 text-muted-foreground" />
                      {batch.batchName}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {batch.count} 条
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_CONFIG[batch.status]?.variant ?? 'outline'}
                        className={`rounded-full text-xs ${STATUS_CONFIG[batch.status]?.className ?? ''}`}
                      >
                        {STATUS_CONFIG[batch.status]?.label ?? batch.status}
                      </Badge>
                      {batch.status === 'rejected' && batch.reviewRemark && (
                        <div className="mt-1 text-[10px] text-destructive max-w-[200px] truncate" title={batch.reviewRemark}>
                          驳回原因：{batch.reviewRemark}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatDateTime(batch.archiveTime)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-full h-7 px-3 text-xs"
                        onClick={() => setPendingDeleteBatch(batch)}
                        disabled={deletingBatchId === batch.batchId}
                      >
                        <Trash2 className="size-3 mr-1" />
                        {deletingBatchId === batch.batchId ? '删除中...' : '删除批次'}
                      </Button>
                    </TableCell>
                  </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
           )
        ) : activeTab === 'history' && !historyLoaded ? (
          <p className="py-8 text-center text-sm text-muted-foreground">加载中...</p>
        ) : !data || data.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {loading ? '加载中...' : activeTab === 'recent' ? '暂无近期归档数据' : '暂无远期归档数据'}
          </p>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="mb-3 flex items-center justify-between rounded-2xl bg-destructive/5 px-4 py-2">
                <span className="text-sm text-destructive">
                  已选 {selectedIds.size} 条
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="size-3.5" />
                  {deleting ? '删除中...' : '删除选中'}
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={data.total > 0 && selectedIds.size === data.total}
                        onChange={() => void toggleSelectAll()}
                        disabled={selectingAll}
                        className="size-4 cursor-pointer accent-primary disabled:cursor-wait"
                      />
                      <span className="text-xs font-bold">全选</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-bold">项目</TableHead>
                  <TableHead className="text-xs font-bold">设备/材料名称</TableHead>
                  <TableHead className="text-xs font-bold">线别</TableHead>
                  <TableHead className="text-xs font-bold">供货</TableHead>
                  <TableHead className="text-xs font-bold text-right">单价(元)</TableHead>
                  <TableHead className="text-xs font-bold">口径</TableHead>
                  <TableHead className="text-xs font-bold">归档日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.project || '-'}
                    </TableCell>
                    <TableCell className="text-sm">{item.device_material_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs rounded-full">
                        {item.line_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{item.supply}</TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {item.unit_price.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.price_caliber}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.settle_date ? item.settle_date.slice(0, 7) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t border-border px-4 py-2">
              <span className="text-xs text-muted-foreground">
                第 {(page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, data.total)} 条，共 {data.total} 条
                {selectedIds.size > 0 && ` · 已选 ${selectedIds.size} 条`}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <span className="mx-1 text-xs text-muted-foreground">|</span>
                <span className="text-xs text-muted-foreground">跳转</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const num = parseInt(jumpPage, 10);
                      if (!Number.isNaN(num) && num >= 1 && num <= totalPages) {
                        setPage(num);
                      }
                      setJumpPage('');
                    }
                  }}
                  className="h-7 w-14 rounded-lg px-2 text-center text-xs"
                  placeholder="页码"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={(() => {
                    const num = parseInt(jumpPage, 10);
                    return Number.isNaN(num) || num < 1 || num > totalPages || num === page;
                  })()}
                  onClick={() => {
                    const num = parseInt(jumpPage, 10);
                    if (!Number.isNaN(num) && num >= 1 && num <= totalPages) {
                      setPage(num);
                      setJumpPage('');
                    }
                  }}
                >
                  Go
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog
        open={!!pendingDeleteBatch}
        onOpenChange={(open) => { if (!open) setPendingDeleteBatch(null); }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除归档批次</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteBatch && (
                <>确定要删除批次「{pendingDeleteBatch.batchName}」吗？该批次包含 {pendingDeleteBatch.count} 条数据，此操作不可恢复。</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">取消</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeleteBatch()}
              disabled={!!deletingBatchId}
            >
              {deletingBatchId ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default ArchivedDataTable;
