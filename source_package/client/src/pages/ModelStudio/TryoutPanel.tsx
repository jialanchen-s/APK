import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Play,
  Upload,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import * as modelApi from '@client/src/api/model';
import type { EditorState } from './useModelStudio';
import type { TryoutResponse, ModelVersion } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface TryoutPanelProps {
  editor: EditorState;
  tryoutResult: TryoutResponse | null;
  tryoutLoading: boolean;
  tryoutPassed: boolean;
  onTryout: (params: Record<string, string | number>) => void;
  onPublish: () => void;
}

const TryoutPanel: React.FC<TryoutPanelProps> = ({
  editor,
  tryoutResult,
  tryoutLoading,
  tryoutPassed,
  onTryout,
  onPublish,
}) => {
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // 当 editor 的 input_vars 变化时重置参数值
  useEffect(() => {
    const initialValues: Record<string, string> = {};
    for (const v of editor.input_vars) {
      if (v.defaultValue !== undefined && v.defaultValue !== null) {
        initialValues[v.name] = String(v.defaultValue);
      } else {
        initialValues[v.name] = v.type === 'string' ? '' : '0';
      }
    }
    setParamValues(initialValues);
  }, [editor.input_vars, editor.id]);

  // 加载版本历史
  useEffect(() => {
    if (!editor.id) {
      setVersions([]);
      return;
    }
    let cancelled = false;
    const loadVersions = async () => {
      setVersionsLoading(true);
      try {
        const res = await modelApi.getModelVersions(editor.id!, 1, 20);
        if (!cancelled) {
          setVersions(res.items);
        }
      } catch (err) {
        logger.error('加载版本历史失败:', JSON.stringify(err));
      } finally {
        if (!cancelled) setVersionsLoading(false);
      }
    };
    loadVersions();
    return () => {
      cancelled = true;
    };
  }, [editor.id]);

  const handleRun = () => {
    const params: Record<string, string | number> = {};
    for (const v of editor.input_vars) {
      const raw = paramValues[v.name] ?? '';
      if (v.type === 'number') {
        params[v.name] = Number(raw) || 0;
      } else {
        params[v.name] = raw;
      }
    }
    onTryout(params);
  };

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-3">
          {/* 试算验证面板 */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Play className="size-4 text-primary" />
              <span className="text-sm font-bold tracking-tight text-foreground">试算验证</span>
            </div>

            {/* 常量展示 */}
            {Object.keys(editor.constants).length > 0 && (
              <div className="rounded-xl border border-border bg-accent/30 px-3 py-2">
                <div className="text-[10px] font-medium text-muted-foreground mb-1.5">公式常量</div>
                <div className="flex flex-col gap-1">
                  {Object.entries(editor.constants).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground">@{key}</span>
                      <span className="font-mono font-medium text-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editor.input_vars.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                请先在左侧定义参数
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {editor.input_vars.map((v) => (
                  <div key={v.name} className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      <span className="font-mono">{v.name}</span>
                      {v.required && <span className="text-destructive">*</span>}
                      {v.description && (
                        <span className="font-normal text-muted-foreground/70">
                          {' '}- {v.description}
                        </span>
                      )}
                    </Label>
                    <Input
                      value={paramValues[v.name] ?? ''}
                      onChange={(e) =>
                        setParamValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                      }
                      className="h-8 font-mono text-xs"
                      placeholder={v.type === 'number' ? '0' : '输入值'}
                    />
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={handleRun}
              disabled={tryoutLoading || editor.input_vars.length === 0 || !editor.id}
              className="w-full rounded-full"
              data-ai-section-type="button"
            >
              {tryoutLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              试运行
            </Button>

            {/* 试算结果 */}
            {tryoutResult && (
              <div
                className={[
                  'rounded-xl border px-3 py-2 text-xs',
                  tryoutResult.success
                    ? 'border-[hsl(94_60%_48%)]/30 bg-[hsl(94_60%_48%)]/5'
                    : 'border-destructive/30 bg-destructive/5',
                ].join(' ')}
              >
                {tryoutResult.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-[hsl(94_60%_48%)]" />
                    <span className="text-[hsl(94_60%_48%)]">计算结果</span>
                    <span className="ml-auto font-mono text-base font-bold text-foreground tabular-nums">
                      {tryoutResult.result}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <span className="text-destructive">{tryoutResult.error}</span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            <Button
              variant="default"
              size="sm"
              onClick={onPublish}
              disabled={!tryoutPassed}
              className="w-full rounded-full"
              data-ai-section-type="button"
            >
              <Upload className="size-3.5" />
              发布模型
            </Button>
            {!tryoutPassed && (
              <span className="text-center text-[10px] text-muted-foreground">
                试算通过后可发布
              </span>
            )}
          </div>

          <Separator />

          {/* 版本审计列表 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <span className="text-sm font-bold tracking-tight text-foreground">版本审计</span>
            </div>

            {versionsLoading ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                加载中...
              </div>
            ) : versions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                暂无版本记录
              </div>
            ) : (
              <Accordion type="multiple" className="flex flex-col gap-1">
                {versions.map((ver, i) => (
                  <AccordionItem
                    key={ver.version + i}
                    value={ver.version + i}
                    className="rounded-xl border border-border px-2.5 last:border-b"
                  >
                    <AccordionTrigger className="py-2 text-xs">
                      <div className="flex w-full items-center gap-2">
                        <ChevronRight className="size-3 text-muted-foreground" />
                        <span className="font-mono font-medium text-foreground">
                          {ver.version}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2 pt-1">
                      <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                        <div>
                          <span>操作人：</span>
                          <span className="font-mono text-foreground">{ver.operator}</span>
                        </div>
                        <div>
                          <span>时间：</span>
                          <span className="font-mono text-foreground">
                            {new Date(ver.operate_time).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <div>
                          <span>变更：</span>
                          <span className="text-foreground">{ver.change_log}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default TryoutPanel;
