import { Boxes, Wrench, FileQuestion } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { PendingGroup, PendingGroupType } from '@shared/api.interface';

interface GroupSidebarProps {
  groups: PendingGroup[];
  selectedGroup: PendingGroupType;
  onSelect: (group: PendingGroupType) => void;
}

const GROUP_META: Record<
  PendingGroupType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  model_param: { label: '待填参数-模型', icon: Boxes },
  retrofit_param: { label: '待填参数-改造白盒', icon: Wrench },
  no_data: { label: '无据待处理', icon: FileQuestion },
};

const GROUP_ORDER: PendingGroupType[] = ['model_param', 'retrofit_param', 'no_data'];

const GroupSidebar: React.FC<GroupSidebarProps> = ({ groups, selectedGroup, onSelect }) => {
  const countMap = new Map(groups.map((g) => [g.type, g.count]));

  return (
    <Tabs
      value={selectedGroup}
      onValueChange={(v) => onSelect(v as PendingGroupType)}
      orientation="vertical"
    >
      <TabsList className="flex flex-col h-auto bg-transparent p-1 gap-1 w-full">
        {GROUP_ORDER.map((type) => {
          const meta = GROUP_META[type];
          const count = countMap.get(type) ?? 0;
          const Icon = meta.icon;
          return (
            <TabsTrigger
              key={type}
              value={type}
              className="justify-start w-full gap-2 h-auto py-2.5 rounded-2xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left text-sm">{meta.label}</span>
              {count > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
};

export default GroupSidebar;
