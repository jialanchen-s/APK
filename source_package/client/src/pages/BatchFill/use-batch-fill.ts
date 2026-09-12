import { useState, useEffect, useCallback } from 'react';
import { getPendingGroups, getPendingItems } from '@client/src/api/pending-item';
import type { PendingGroup, PendingGroupType, PendingItem } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

const PAGE_SIZE = 200;

export function useBatchFill(taskId: string | null) {
  const [groups, setGroups] = useState<PendingGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<PendingGroupType>('model_param');
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setGroups([]);
      return;
    }
    getPendingGroups(taskId)
      .then((res) => {
        setGroups(res.groups);
        if (res.groups.length > 0) {
          let maxGroup: PendingGroup = res.groups[0];
          for (const g of res.groups) {
            if (g.count > maxGroup.count) maxGroup = g;
          }
          setSelectedGroup(maxGroup.type);
        }
      })
      .catch((err) => logger.error('获取分组失败:', JSON.stringify(err)));
  }, [taskId]);

  const loadItems = useCallback(() => {
    if (!taskId) {
      setItems([]);
      return;
    }
    setLoading(true);
    getPendingItems(taskId, selectedGroup, 1, PAGE_SIZE)
      .then((res) => setItems(res.items))
      .catch((err) => logger.error('获取待填项失败:', JSON.stringify(err)))
      .finally(() => setLoading(false));
  }, [taskId, selectedGroup]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return { groups, selectedGroup, setSelectedGroup, items, loading, loadItems };
}
