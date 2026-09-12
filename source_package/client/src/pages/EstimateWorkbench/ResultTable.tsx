import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EstimateTaskItem } from '@shared/api.interface';

interface ResultTableProps {
  items: EstimateTaskItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  success: { label: '成功', variant: 'default' },
  jia_gong: { label: '甲供', variant: 'secondary' },
  pending: { label: '待处理', variant: 'destructive' },
  filled: { label: '已填报', variant: 'outline' },
  submitted: { label: '已提交', variant: 'outline' },
};

// 溯源标签样式映射
const TRACE_TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  '正常': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  '跨线': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  '甲供-不计费': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  '待人工': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

function formatPrice(price: number): string {
  if (!price && price !== 0) return '-';
  return price.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// 渲染溯源信息
function renderTraceInfo(item: EstimateTaskItem) {
  const tag = item.trace_tag || '正常';
  const styles = TRACE_TAG_STYLES[tag] || TRACE_TAG_STYLES['正常'];

  // 构建溯源详情：项目 / 线别 / 工位
  const parts: string[] = [];
  if (item.source) parts.push(`项目:${item.source}`);
  if (item.line_type) parts.push(`线别:${item.line_type}`);
  if (item.workstation_no) parts.push(`工位:${item.workstation_no}`);

  const detail = parts.join(' ') || item.trace_detail || item.remark || '-';

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] px-1.5 py-0 h-5 font-medium rounded shrink-0',
          styles.bg,
          styles.text,
          styles.border
        )}
      >
        {tag}
      </Badge>
      <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={detail}>
        {detail}
      </span>
    </div>
  );
}

const ResultTable = ({
  items,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
}: ResultTableProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl border border-gray-100 bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/50 hover:bg-accent/50">
              <TableHead className="w-[140px]">具体设备名称</TableHead>
              <TableHead className="w-[80px]">类别</TableHead>
              <TableHead className="w-[70px]">区分</TableHead>
              <TableHead className="w-[70px]">供货</TableHead>
              <TableHead className="w-[60px] text-right">数量</TableHead>
              <TableHead className="w-[110px] text-right">最终单价(未税)</TableHead>
              <TableHead className="w-[110px] text-right">最终总价(未税)</TableHead>
              <TableHead className="min-w-[160px]">备注(溯源)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Inbox className="size-8 opacity-40" />
                    <span className="text-sm">暂无数据</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const statusInfo = STATUS_MAP[item.status] ?? {
                  label: item.status,
                  variant: 'outline' as const,
                };
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <TableRow className="cursor-default h-11 hover:bg-accent/30">
                        <TableCell className="font-medium text-sm">
                          {item.device_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.match_level || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.usage_scope}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.supply_type}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-mono text-sm">
                          {item.quantity || '-'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-mono text-sm">
                          {item.status === 'jia_gong' ? '0.0' : formatPrice(item.price)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-mono font-medium text-sm">
                          {item.status === 'jia_gong' ? '0.0' : formatPrice(item.total_price)}
                        </TableCell>
                        <TableCell>
                          {renderTraceInfo(item)}
                        </TableCell>
                      </TableRow>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="flex flex-col gap-1 text-xs">
                        <span><strong>设备:</strong> {item.device_name}</span>
                        <span><strong>线别:</strong> {item.line_type}</span>
                        <span><strong>来源:</strong> {item.source}</span>
                        <span><strong>工位号:</strong> {item.workstation_no || '-'}</span>
                        <span><strong>工位描述:</strong> {item.workstation_desc || '-'}</span>
                        {item.spec_remark && (
                          <span><strong>规格/备注:</strong> {item.spec_remark}</span>
                        )}
                        <span><strong>匹配:</strong> {item.match_level}</span>
                        {item.trace_tag && (
                          <span><strong>溯源:</strong> {item.trace_tag} - {item.trace_detail || `${item.source ? '项目:' + item.source : ''}${item.line_type ? ' 线别:' + item.line_type : ''}${item.workstation_no ? ' 工位:' + item.workstation_no : ''}`}</span>
                        )}
                        <span><strong>状态:</strong> {statusInfo.label}</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          共 {total} 条，第 {page} / {totalPages} 页
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            下一页
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResultTable;
