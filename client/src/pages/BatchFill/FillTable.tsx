import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
 import { Check, Boxes, Wand2, Loader2, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@client/src/common/platform/logger';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { tryoutModelByModelId } from '@client/src/api/model';
import { capabilityClient } from '@client/src/common/platform/capability-client';
import type { PendingItem, PendingItemParam } from '@shared/api.interface';
import type { WeldingEquipmentParamExtractOneOutput } from '@shared/plugin-types';

 const PARAM_LABELS: Record<string, string> = {
   line_type: '线体类型',
   modify_level: '改造级别',
   unit: '单位',
 };
 const HIDDEN_PARAMS = new Set(['usage_scope', 'copy_mode']);

interface FillTableProps {
  items: PendingItem[];
  loading: boolean;
  editValues: Record<string, Record<string, string>>;
  onEditValue: (itemId: string, paramName: string, value: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (itemId: string) => void;
  onToggleSelectAll: () => void;
  onApplyModel: () => void;
  onAIExtract: (
    itemId: string,
    extractedParams: Record<string, string>,
  ) => void;
  applyFlash: Set<string>;
  showCheck: boolean;
  activeModelId: string | null;
}

const FillTable: React.FC<FillTableProps> = ({
  items,
  loading,
  editValues,
  onEditValue,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onApplyModel,
  onAIExtract,
  applyFlash,
  showCheck,
  activeModelId,
}) => {
  const [extracting, setExtracting] = useState<Set<string>>(new Set());
  const [extractProgress, setExtractProgress] = useState<{ done: number; total: number } | null>(null);
  const [rowPrices, setRowPrices] = useState<Record<string, { price: number | null; loading: boolean; error: string | null }>>({});
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());

  const toggleSpecExpand = (id: string) => {
    setExpandedSpecs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const tryoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paramNames = new Set<string>();
  const paramDefs: PendingItemParam[] = [];
  for (const item of items) {
    for (const param of item.params) {
      if (!paramNames.has(param.name)) {
        paramNames.add(param.name);
        paramDefs.push(param);
      }
    }
  }
  const allSelected =
    items.length > 0 && items.every((i: PendingItem) => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0 && !allSelected;
  const isExtracting = extracting.size > 0;

  const getRowParamValues = (item: PendingItem): Record<string, string> => {
    const paramDefaults: Record<string, string> = {};
    for (const p of item.params) {
      if (p.value !== undefined && p.value !== null && p.value !== '') {
        paramDefaults[p.name] = String(p.value);
      }
    }
    return {
      ...paramDefaults,
      ...Object.fromEntries(
        Object.entries(item.filled_values ?? {}).map(
          ([k, v]) => [k, String(v)] as [string, string],
        ),
      ),
      ...(editValues[item.id] ?? {}),
    };
  };

  const computeRowPrices = useCallback(async () => {
    const rowsToCalc = items.filter((item: PendingItem) => item.model_id);
    if (rowsToCalc.length === 0) {
      setRowPrices({});
      return;
    }
    setRowPrices((prev) => {
      const next: Record<string, { price: number | null; loading: boolean; error: string | null }> = {};
      for (const item of rowsToCalc) {
        next[item.id] = { price: prev[item.id]?.price ?? null, loading: true, error: null };
      }
      return next;
    });
    await Promise.all(
      rowsToCalc.map(async (item: PendingItem) => {
        const values = getRowParamValues(item);
        try {
          const res = await tryoutModelByModelId(item.model_id!, { params: values });
          setRowPrices((prev) => ({
            ...prev,
            [item.id]: {
              price: res.success && typeof res.result === 'number' ? res.result : null,
              loading: false,
              error: res.success ? null : (res.error || '计算失败'),
            },
          }));
        } catch {
          setRowPrices((prev) => ({
            ...prev,
            [item.id]: { price: null, loading: false, error: '试算失败' },
          }));
        }
      }),
    );
  }, [items, editValues]);

  useEffect(() => {
    if (items.length === 0) {
      setRowPrices({});
      return;
    }
    if (tryoutTimerRef.current) clearTimeout(tryoutTimerRef.current);
    tryoutTimerRef.current = setTimeout(() => {
      computeRowPrices();
    }, 400);
    return () => {
      if (tryoutTimerRef.current) clearTimeout(tryoutTimerRef.current);
    };
  }, [items, editValues, computeRowPrices]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const callWithRetry = async (
    deviceName: string,
    maxRetries = 2,
  ): Promise<Record<string, unknown> | null> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await capabilityClient
          .load('welding_equipment_param_extract_1')
          .call<WeldingEquipmentParamExtractOneOutput>('textToJson', {
            equipment_text: deviceName,
          });
        return result as unknown as Record<string, unknown>;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit = errMsg.includes('频繁') || errMsg.includes('RateLimit');
        if (isRateLimit && attempt < maxRetries) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        throw err;
      }
    }
    return null;
  };

  const handleAIExtract = async () => {
    const targets: PendingItem[] =
      selectedIds.size > 0
        ? items.filter((i: PendingItem) => selectedIds.has(i.id))
        : items;
    if (targets.length === 0) return;

    let successCount = 0;
    let failCount = 0;
    setExtractProgress({ done: 0, total: targets.length });

    for (let idx = 0; idx < targets.length; idx++) {
      const item = targets[idx];
      setExtracting((prev) => new Set(prev).add(item.id));
      setExtractProgress({ done: idx, total: targets.length });
      try {
        const result = await callWithRetry(item.device_name);
        if (result) {
          const extracted: Record<string, string> = {};
          for (const param of item.params) {
            const val = result[param.name];
            if (val !== undefined && val !== null && val !== '' && val !== 0) {
              extracted[param.name] = String(val);
            }
          }
          if (Object.keys(extracted).length > 0) {
            onAIExtract(item.id, extracted);
            successCount++;
          }
        }
      } catch (err) {
        logger.error(
          `AI提取失败 [${item.device_name}]:`,
          JSON.stringify(err),
        );
        failCount++;
      } finally {
        setExtracting((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
      if (idx < targets.length - 1) {
        await sleep(800);
      }
    }

    setExtractProgress({ done: targets.length, total: targets.length });
    setTimeout(() => setExtractProgress(null), 1000);

    if (successCount > 0 && failCount === 0) {
      toast.success(`AI提取完成，成功提取 ${successCount} 项参数`);
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`AI提取完成：成功 ${successCount} 项，失败 ${failCount} 项`);
    } else if (failCount > 0) {
      toast.error(`AI提取失败，${failCount} 项均未成功`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        暂无待处理项
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onApplyModel}
          disabled={selectedIds.size < 1}
          className="gap-1.5 rounded-full"
        >
          <Boxes className="size-4" />
          选择模型
          <AnimatePresence>
            {showCheck && (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.2 }}
                className="ml-1 inline-flex"
              >
                <Check className="size-4 text-success" />
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAIExtract}
          disabled={items.length === 0 || isExtracting}
          className="gap-1.5 rounded-full"
        >
          {isExtracting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
          {extractProgress
            ? `AI提取 ${extractProgress.done}/${extractProgress.total}`
            : 'AI自动提取'}
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          已选 {selectedIds.size} / {items.length} 项
        </span>
        {activeModelId && items.length > 0 && (() => {
          const firstRp = rowPrices[items[0]?.id];
          return (
            <div className="ml-auto flex items-center gap-2 bg-accent/50 rounded-full px-4 py-1.5">
              <Calculator className="size-4 text-primary" />
              <span className="text-xs text-muted-foreground">首行估算价</span>
              {firstRp?.loading ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : firstRp?.error ? (
                <span className="text-xs text-destructive">{firstRp.error}</span>
              ) : (
                <span className="font-mono font-bold text-foreground">
                  {firstRp?.price?.toFixed(2) ?? '-'}
                  <span className="text-xs font-normal text-muted-foreground ml-1">元</span>
                </span>
              )}
            </div>
          );
        })()}
      </div>

      {/* Table */}
      <div className="border border-gray-100 rounded-3xl shadow-sm overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={() => onToggleSelectAll()}
                />
              </TableHead>
              <TableHead className="min-w-[120px]">设备名称</TableHead>
              <TableHead className="min-w-[80px]">线别</TableHead>
              <TableHead className="min-w-[180px]">
                规格/备注
                <button
                  type="button"
                  onClick={() => {
                    const allHas = items.every(
                      (it) => it.spec_remark && it.spec_remark.length > 30,
                    );
                    setExpandedSpecs(
                      allHas
                        ? new Set()
                        : new Set(
                            items
                              .filter((it) => it.spec_remark && it.spec_remark.length > 30)
                              .map((it) => it.id),
                          ),
                    );
                  }}
                  className="ml-1 text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  全部展开
                </button>
              </TableHead>
              {paramDefs.filter((p) => !HIDDEN_PARAMS.has(p.name)).map((param: PendingItemParam) => (
                <TableHead key={param.name} className="min-w-[120px]">
                  {PARAM_LABELS[param.name] ?? param.name}
                  {param.required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </TableHead>
              ))}
              <TableHead className="min-w-[100px]">估算价格</TableHead>
              <TableHead className="min-w-[120px]">
                人工价格（元）
                <span className="ml-1 text-[10px] text-muted-foreground">直填计入成果单</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: PendingItem) => {
              const isSelected = selectedIds.has(item.id);
              const isFlashing = applyFlash.has(item.id);
              return (
                <TableRow
                  key={item.id}
                  className={`transition-colors duration-300 ${
                    isFlashing ? 'bg-success/10' : ''
                  }`}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.device_name}
                    {item.model_id && (
                      <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        已匹配模型
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.line_type ||
                      String(item.filled_values?._line_type ?? '') ||
                      '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[240px]">
                    {item.spec_remark ? (
                      expandedSpecs.has(item.id) ? (
                        <div className="whitespace-pre-wrap break-words">
                          {item.spec_remark}
                          <button
                            type="button"
                            onClick={() => toggleSpecExpand(item.id)}
                            className="ml-2 inline-flex items-center text-[10px] text-primary hover:underline align-middle"
                          >
                            收起
                            <ChevronUp className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="group relative">
                          <div
                            className={`truncate cursor-pointer hover:text-foreground ${
                              item.spec_remark.length > 30 ? '' : 'cursor-default'
                            }`}
                            onClick={() =>
                              item.spec_remark && item.spec_remark.length > 30
                                ? toggleSpecExpand(item.id)
                                : null
                            }
                            title={item.spec_remark}
                          >
                            {item.spec_remark}
                          </div>
                          {item.spec_remark.length > 30 && (
                            <button
                              type="button"
                              onClick={() => toggleSpecExpand(item.id)}
                              className="mt-1 inline-flex items-center text-[10px] text-primary hover:underline"
                            >
                              展开
                              <ChevronDown className="size-3" />
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  {paramDefs.filter((p) => !HIDDEN_PARAMS.has(p.name)).map((param: PendingItemParam) => {
                    const edited = editValues[item.id]?.[param.name];
                    const value =
                      edited ??
                      String(item.filled_values?.[param.name] ?? param.value ?? '');
                    const isMissing = param.required && !value;
                    return (
                      <TableCell key={param.name}>
                        <Input
                          value={value}
                          onChange={(e) =>
                            onEditValue(item.id, param.name, e.target.value)
                          }
                          aria-invalid={isMissing}
                          className={`h-8 w-28 tabular-nums ${isMissing ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                          placeholder={isMissing ? '必填' : ''}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    {(() => {
                      const rp = rowPrices[item.id];
                      if (!item.model_id) return <span className="text-muted-foreground">—</span>;
                      if (!rp || rp.loading) return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
                      if (rp.error) return <span className="text-xs text-destructive">{rp.error}</span>;
                      return (
                        <span className="font-mono font-bold text-foreground tabular-nums">
                          {rp.price?.toFixed(2) ?? '-'}
                          <span className="text-xs font-normal text-muted-foreground ml-1">元</span>
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editValues[item.id]?.['_manual_price'] ?? ''}
                      onChange={(e) =>
                        onEditValue(item.id, '_manual_price', e.target.value)
                      }
                      inputMode="decimal"
                      placeholder="选填"
                      className="h-8 w-28 tabular-nums"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FillTable;
