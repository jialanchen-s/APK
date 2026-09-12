import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { getEstimateTaskItems } from '@client/src/api/estimate-task';
import { downloadItemsAsExcel } from './excel-export';
import { toast } from 'sonner';
import { logger } from '@client/src/common/platform/logger';
import { cn } from '@/lib/utils';
import type { EstimateTaskItem } from '@shared/api.interface';

interface DownloadSectionProps {
  taskId: string;
  hasResult: boolean;
  fileName?: string;
  lineType?: string;
}

const PAGE_SIZE = 500;

const DownloadSection = ({ taskId, hasResult, fileName, lineType }: DownloadSectionProps) => {
  const [downloading, setDownloading] = useState(false);

  const fetchAllItems = async (): Promise<EstimateTaskItem[]> => {
    const allItems: EstimateTaskItem[] = [];
    let page = 1;
    let total = 0;
    do {
      const res = await getEstimateTaskItems(
        taskId,
        page,
        PAGE_SIZE,
        'all',
      );
      allItems.push(...res.items);
      total = res.total;
      page++;
    } while (allItems.length < total);
    return allItems;
  };

  const handleDownload = async () => {
    if (!taskId) return;
    setDownloading(true);
    try {
      const items = await fetchAllItems();
      
      // 填充溯源信息（如果后端未返回，使用默认值）
      const enrichedItems = items.map(item => {
        // 根据状态推断溯源标签
        let traceTag = item.trace_tag;
        let traceDetail = item.trace_detail;
        
        if (!traceTag) {
          if (item.status === 'jia_gong') {
            traceTag = '甲供-不计费';
            traceDetail = '甲供物料，无需采购定价';
          } else if (item.status === 'pending') {
            traceTag = '待人工';
            traceDetail = '拦截-无据可查';
          } else if (item.match_level?.includes('跨线')) {
            traceTag = '跨线';
            traceDetail = item.remark || '参考其他产线数据';
          } else {
            traceTag = '正常';
            traceDetail = item.remark || item.source || '本线匹配';
          }
        }
        
        return {
          ...item,
          trace_tag: traceTag,
          trace_detail: traceDetail,
        };
      });
      
      const exportFileName = fileName 
        ? `${fileName.replace(/\.xlsx?$/i, '')}_测算结果.xlsx`
        : '测算结果_无损回填.xlsx';
      
      downloadItemsAsExcel(enrichedItems, exportFileName);
      
      toast.success('导出成功', {
        description: `已导出 ${enrichedItems.length} 条数据`,
      });
    } catch (err) {
      logger.error('导出结果失败:', JSON.stringify(err));
      toast.error('导出失败', {
        description: '获取数据时出错，请重试',
      });
    } finally {
      setDownloading(false);
    }
  };

  if (!hasResult) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="size-4" />
        <span>
          {lineType ? `主成果表 (${lineType})` : '主成果表'}
        </span>
      </div>
      <Button
        variant="default"
        className={cn(
          'rounded-full bg-primary hover:bg-primary/90',
          'text-primary-foreground font-medium',
        )}
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin mr-1.5" />
        ) : (
          <Download className="size-4 mr-1.5" />
        )}
        导出 Excel（无损回填）
      </Button>
    </div>
  );
};

export default DownloadSection;
