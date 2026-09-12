import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ListOrdered,
  CheckCircle2,
  PackageCheck,
  AlertCircle,
} from 'lucide-react';
import type { EstimateItemFilter } from '@shared/api.interface';
import { useNavigate } from 'react-router-dom';

interface StatCardData {
  key: EstimateItemFilter;
  label: string;
  subLabel?: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

interface StatCardsProps {
  total: number;
  success: number;
  jiaGong: number;
  pending: number;
  activeFilter: EstimateItemFilter;
  onFilterChange: (filter: EstimateItemFilter) => void;
  taskId?: string | null;
}

const CARDS = (total: number, success: number, jiaGong: number, pending: number): StatCardData[] => [
  {
    key: 'all',
    label: '共计',
    value: total,
    icon: ListOrdered,
    color: 'text-foreground',
    bgColor: 'bg-muted',
  },
  {
    key: 'success',
    label: '成功测算',
    value: success,
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  {
    key: 'jia_gong',
    label: '甲供不计费',
    subLabel: '(记0)',
    value: jiaGong,
    icon: PackageCheck,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
  },
  {
    key: 'pending',
    label: '待人工',
    subLabel: '(未知清单)',
    value: pending,
    icon: AlertCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
];

const StatCards = ({
  total,
  success,
  jiaGong,
  pending,
  activeFilter,
  onFilterChange,
  taskId,
}: StatCardsProps) => {
  const navigate = useNavigate();
  const cards = CARDS(total, success, jiaGong, pending);

  const handleCardClick = (key: EstimateItemFilter) => {
    if (key === 'pending' && pending > 0 && taskId) {
      navigate(`/batch-fill?taskId=${taskId}`);
    } else {
      onFilterChange(key);
    }
  };

  return (
    <div
      data-ai-section-type="card-stat"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
    >
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.key;
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.06 }}
          >
            <Card
              className={cn(
                'cursor-pointer rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all',
                isActive
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40',
              )}
              onClick={() => handleCardClick(card.key)}
            >
              <div className="flex flex-col p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    {card.label}
                    {card.subLabel && (
                      <span className="text-muted-foreground/70">{card.subLabel}</span>
                    )}
                  </span>
                  <div
                    className={cn(
                      'flex size-7 items-center justify-center rounded-lg',
                      card.bgColor,
                    )}
                  >
                    <Icon className={cn('size-4', card.color)} />
                  </div>
                </div>
                <div
                  className={cn(
                    'text-3xl font-bold tabular-nums tracking-tight',
                    card.color,
                  )}
                >
                  <CountUp end={card.value} duration={0.8} />
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};

export default StatCards;
