import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { ContractPreviewItem } from '@shared/api.interface';

interface ContractPreviewTableProps {
  items: ContractPreviewItem[];
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDeleteRow: (id: string) => void;
}

const ContractPreviewTable = ({
  items,
  currentPage,
  pageSize,
  onPageChange,
  onDeleteRow,
}: ContractPreviewTableProps) => {
  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const start = (currentPage - 1) * pageSize;
  const pagedItems = items.slice(start, start + pageSize);
  const startIdx = start + 1;
  const endIdx = Math.min(start + pageSize, items.length);

  return (
    <div className="rounded-3xl border border-gray-100 bg-card shadow-sm transition-all hover:shadow-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>项目</TableHead>
            <TableHead>设备/材料名称</TableHead>
            <TableHead>线别</TableHead>
            <TableHead className="text-right">单价(元)</TableHead>
            <TableHead className="text-center">状态</TableHead>
            <TableHead className="text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            pagedItems.map((item) => {
              const isPriceAnomaly = item.invalidReason === '价格异常';
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">
                    {item.project || '-'}
                  </TableCell>
                  <TableCell>{item.device_material_name || '-'}</TableCell>
                  <TableCell>{item.line_type || '-'}</TableCell>
                  <TableCell className="text-right">
                    {isPriceAnomaly ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex rounded-xl bg-yellow-100 px-2 py-0.5"
                          >
                            <span className="font-mono text-yellow-800">
                              {item.unit_price}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>价格异常：超出正常范围</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="font-mono">{item.unit_price}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.status === 'valid' ? (
                      <CheckCircle2 className="mx-auto size-4 text-success" />
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex">
                            <XCircle className="size-4 text-destructive" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.invalidReason || '无效'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => onDeleteRow(item.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">
          第 {startIdx}-{endIdx} 条，共 {items.length} 条
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ContractPreviewTable;
