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
  FileText,
} from 'lucide-react';
import type { ArchiveDomain, ContractPreviewItemUnion } from '@shared/api.interface';
import { cn } from '@/lib/utils';

interface FileGroup {
  sourceFile: string;
  items: ContractPreviewItemUnion[];
}

interface ContractPreviewTableProps {
  items: ContractPreviewItemUnion[];
  domain: ArchiveDomain;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDeleteRow: (id: string) => void;
  onDeleteFile?: (sourceFile: string) => void;
}

const ContractPreviewTable = ({
  items,
  domain,
  currentPage,
  pageSize,
  onPageChange,
  onDeleteRow,
  onDeleteFile,
}: ContractPreviewTableProps) => {
  const fileGroups: FileGroup[] = items.reduce<FileGroup[]>((acc, item) => {
    const sourceFile = item.source_file ?? '未命名文件';
    let group = acc.find((g) => g.sourceFile === sourceFile);
    if (!group) {
      group = { sourceFile, items: [] };
      acc.push(group);
    }
    group.items.push(item);
    return acc;
  }, []);

  const pagedGroups: FileGroup[] = [];
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  let offset = 0;
  for (const g of fileGroups) {
    if (offset >= end) break;
    const groupStart = Math.max(0, start - offset);
    const groupEnd = Math.min(g.items.length, end - offset);
    if (groupEnd > groupStart) {
      pagedGroups.push({ sourceFile: g.sourceFile, items: g.items.slice(groupStart, groupEnd) });
    }
    offset += g.items.length;
  }

  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const startIdx = start + 1;
  const endIdx = Math.min(end, items.length);
  const singleFile = fileGroups.length <= 1;
  const isManufacturing = domain !== 'welding';

  const hasLineType = (item: ContractPreviewItemUnion): item is ContractPreviewItemUnion & { line_type: string } =>
    'line_type' in item;
  const hasSpec = (item: ContractPreviewItemUnion): item is ContractPreviewItemUnion & { specification: string } =>
    'specification' in item;

  return (
    <div className="rounded-3xl border border-gray-100 bg-card shadow-sm transition-all hover:shadow-md">
      <Table>
        <TableHeader>
           <TableRow>
             <TableHead className="w-48">来源文件</TableHead>
             <TableHead>项目</TableHead>
             <TableHead>设备/材料名称</TableHead>
             {isManufacturing ? (
               <TableHead>规格型号</TableHead>
             ) : (
               <TableHead>线别</TableHead>
             )}
             <TableHead className="text-right">单价(元)</TableHead>
             <TableHead className="text-center">状态</TableHead>
             <TableHead className="text-center w-24">操作</TableHead>
           </TableRow>
        </TableHeader>
        <TableBody>
           {items.length === 0 ? (
             <TableRow>
               <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                 暂无数据
               </TableCell>
             </TableRow>
           ) : (
             pagedGroups.map((group) => (
               group.items.map((item, idx) => {
                 const isPriceAnomaly = item.invalidReason === '价格异常';
                 const isFirst = idx === 0;
                 return (
                   <TableRow key={`${group.sourceFile}-${item.id}`}>
                     <TableCell className={cn('font-mono text-xs align-top', isFirst ? 'border-t-2 border-t-gray-100' : '')}>
                       {isFirst ? (
                         <div className="flex items-center justify-between gap-2 py-1">
                           <div className="flex items-center gap-1.5 min-w-0">
                             <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                             <span className="truncate font-medium text-foreground" title={group.sourceFile}>
                               {group.sourceFile}
                             </span>
                           </div>
                           {!singleFile && onDeleteFile && (
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   className="h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                                   onClick={() => onDeleteFile(group.sourceFile)}
                                 >
                                   <Trash2 className="size-3.5" />
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>移除该文件全部数据</TooltipContent>
                             </Tooltip>
                           )}
                         </div>
                       ) : null}
                     </TableCell>
                     <TableCell className="font-mono text-xs">
                       {item.project || '-'}
                     </TableCell>
                     <TableCell>{item.device_material_name || '-'}</TableCell>
                     {isManufacturing ? (
                       <TableCell>{hasSpec(item) ? item.specification || '-' : '-'}</TableCell>
                     ) : (
                       <TableCell>{hasLineType(item) ? item.line_type || '-' : '-'}</TableCell>
                     )}
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
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">
          第 {startIdx}-{endIdx} 条，共 {items.length} 条
          {!singleFile && <span className="ml-2">（{fileGroups.length} 个文件）</span>}
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
