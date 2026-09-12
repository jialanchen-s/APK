import { Card } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnomalyDetectionResult } from '@shared/api.interface';

interface AnomalyCardProps {
  result: AnomalyDetectionResult;
}

const RISK_STYLES: Record<string, { icon: typeof ShieldCheck; color: string; bgColor: string; borderColor: string; label: string }> = {
  low: { icon: ShieldCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', label: '低风险' },
  medium: { icon: ShieldAlert, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', label: '中风险' },
  high: { icon: ShieldX, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: '高风险' },
};

const AnomalyCard = ({ result }: AnomalyCardProps) => {
  const style = RISK_STYLES[result.risk_level] ?? RISK_STYLES['low'];
  const Icon = style.icon;
  const anomalyDevices = result.anomaly_devices
    ? result.anomaly_devices.split(',').filter(Boolean)
    : [];

  return (
    <Card className={cn('rounded-3xl shadow-sm border', style.borderColor)}>
      <div className="flex items-start gap-4 p-5">
        <div className={cn('flex size-10 items-center justify-center rounded-xl shrink-0', style.bgColor)}>
          <Icon className={cn('size-5', style.color)} />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-tight text-foreground">
              异常检测报告
            </h3>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', style.bgColor, style.color)}>
              {style.label}
            </span>
            {result.anomaly_count > 0 && (
              <span className="text-xs text-muted-foreground">
                {result.anomaly_count} 项异常
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.overall_assessment}
          </p>

          {anomalyDevices.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {anomalyDevices.map((device, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200"
                >
                  {device.trim()}
                </span>
              ))}
            </div>
          )}

          {result.recommendation && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground shrink-0">建议：</span>
              <span className="leading-relaxed">{result.recommendation}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default AnomalyCard;
