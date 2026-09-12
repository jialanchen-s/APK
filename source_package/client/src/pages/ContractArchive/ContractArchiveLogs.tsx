import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { History } from 'lucide-react';
import dayjs from 'dayjs';
import type { ContractArchiveLog } from '@shared/api.interface';

interface ContractArchiveLogsProps {
  logs: ContractArchiveLog[];
}

const ContractArchiveLogs = ({ logs }: ContractArchiveLogsProps) => {
  return (
    <Card className="rounded-3xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
          <History className="size-4" />
          归档日志
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">暂无归档记录</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-foreground">{log.operator}</span>
                  <span className="text-muted-foreground">
                    归档入库 <span className="font-mono">{log.count}</span> 条
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {dayjs(log.operate_time).format('YYYY-MM-DD HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractArchiveLogs;
