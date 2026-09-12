import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, AlertTriangle, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import type {
  AgentMessage,
  AgentMessageMetadata,
  DeviceMatchItem,
  ParamExtractItem,
  AnomalyItem,
} from '@shared/api.interface';

interface ActionCardProps {
  messageId: string;
  status: string;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  actionLoading: string | null;
}

function ActionButtons({ messageId, status, onConfirm, onReject, actionLoading }: ActionCardProps) {
  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
        <Check className="size-3.5" />
        <span>已确认</span>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <X className="size-3.5" />
        <span>已跳过</span>
      </div>
    );
  }
  const isLoading = actionLoading === messageId;
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="default"
        className="rounded-full"
        disabled={isLoading}
        onClick={() => onConfirm(messageId)}
      >
        <Check className="mr-1 size-3.5" />
        确认
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        disabled={isLoading}
        onClick={() => onReject(messageId)}
      >
        <X className="mr-1 size-3.5" />
        跳过
      </Button>
    </div>
  );
}

function confidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-emerald-600 bg-emerald-50';
  if (confidence >= 60) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function levelBadge(level: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (level === 'critical') return { label: '严重', variant: 'destructive' };
  if (level === 'warning') return { label: '警告', variant: 'secondary' };
  return { label: '正常', variant: 'outline' };
}

export const DeviceMatchCard: React.FC<ActionCardProps & { devices: DeviceMatchItem[] }> = ({
  devices,
  ...props
}) => {
  const highConfidence = devices.filter((d) => d.confidence >= 60).length;
  return (
    <Card className="mt-2 p-3 space-y-3 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          设备智能匹配（{highConfidence}/{devices.length} 高置信）
        </span>
        <ActionButtons {...props} />
      </div>
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
        {devices.map((d) => (
          <div key={d.pending_item_id} className="flex items-center gap-2 rounded-xl border border-border p-2 text-xs">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{d.device_name}</div>
              <div className="text-muted-foreground truncate">
                {d.matched_model_name ? `→ ${d.matched_model_name}` : '未匹配'}
              </div>
              {d.match_reason && (
                <div className="text-muted-foreground/70 truncate mt-0.5">{d.match_reason}</div>
              )}
            </div>
            <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium', confidenceColor(d.confidence))}>
              {d.confidence}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const ParamExtractCard: React.FC<ActionCardProps & { params: ParamExtractItem[] }> = ({
  params,
  ...props
}) => {
  return (
    <Card className="mt-2 p-3 space-y-3 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          参数自动提取（{params.length} 台设备）
        </span>
        <ActionButtons {...props} />
      </div>
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
        {params.map((p) => (
          <div key={p.pending_item_id} className="rounded-xl border border-border p-2 text-xs">
            <div className="font-medium mb-1">{p.device_name}</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(p.params).map(([k, v]) => (
                <span key={k} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                  {k}: {String(v)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const AnomalyCheckCard: React.FC<ActionCardProps & {
  anomalies: AnomalyItem[];
  riskLevel: string;
  recommendation?: string;
  overallAssessment?: string;
}> = ({ anomalies, riskLevel, recommendation, overallAssessment, ...props }) => {
  const warningCount = anomalies.filter((a) => a.level === 'warning' || a.level === 'critical').length;
  return (
    <Card className="mt-2 p-3 space-y-3 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            异常检测结果
          </span>
          {warningCount > 0 ? (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="mr-0.5 size-2.5" />
              {warningCount} 项异常
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              <ShieldCheck className="mr-0.5 size-2.5" />
              无异常
            </Badge>
          )}
        </div>
        <ActionButtons {...props} />
      </div>
      {overallAssessment && (
        <div className="rounded-xl bg-muted/50 p-2 text-xs text-muted-foreground">
          {overallAssessment}
        </div>
      )}
      {anomalies.length > 0 && (
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
          {anomalies.map((a, idx) => {
            const badge = levelBadge(a.level);
            return (
              <div key={idx} className="flex items-center gap-2 rounded-xl border border-border p-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.device_name}</div>
                  <div className="text-muted-foreground">
                    测算 {a.calculated_price} 元 vs 均价 {a.historical_avg} 元
                  </div>
                </div>
                <span className={cn(
                  'shrink-0 font-medium',
                  a.deviation > 20 ? 'text-red-600' : a.deviation > 10 ? 'text-amber-600' : a.deviation < -20 ? 'text-red-600' : a.deviation < -10 ? 'text-amber-600' : 'text-emerald-600',
                )}>
                  {a.deviation > 0 ? '+' : ''}{a.deviation}%
                </span>
                <Badge variant={badge.variant} className="shrink-0 text-[10px]">
                  {badge.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
      {recommendation && (
        <div className="rounded-xl bg-amber-50 p-2 text-xs text-amber-700">
          建议：{recommendation}
        </div>
      )}
    </Card>
  );
};
