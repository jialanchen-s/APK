import { useState, useEffect } from 'react';
import { Boxes, Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getModels } from '@client/src/api/model';
import type { ModelItem, ModelInputVar } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface ModelSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (modelId: string, paramValues: Record<string, string>) => void;
  loading: boolean;
}

const ModelSelectDialog: React.FC<ModelSelectDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
  loading,
}) => {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setParamValues({});
    setFetchLoading(true);
    getModels(1, 200)
      .then((res) => {
        setModels(
          res.items.filter((m: ModelItem) => m.status === 'published'),
        );
      })
      .catch((err) => {
        logger.error('获取模型列表失败:', JSON.stringify(err));
      })
      .finally(() => setFetchLoading(false));
  }, [open]);

  const handleSelectModel = (model: ModelItem) => {
    setSelectedId(model.id);
    const initialValues: Record<string, string> = {};
    for (const v of model.input_vars ?? []) {
      initialValues[v.name] = v.defaultValue != null ? String(v.defaultValue) : '';
    }
    setParamValues(initialValues);
  };

  const handleParamChange = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleApply = () => {
    if (!selectedId) return;
    onSelect(selectedId, paramValues);
  };

  const selectedModel = models.find((m) => m.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="size-5 text-primary" />
            选择模型
          </DialogTitle>
          <DialogDescription>
            选择已发布模型后，填写参数并应用到选中的设备
          </DialogDescription>
        </DialogHeader>

        {fetchLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" />
            加载模型列表...
          </div>
        ) : models.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            暂无已发布模型
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
            {models.map((model: ModelItem) => {
              const isSelected = selectedId === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelectModel(model)}
                  className={`w-full text-left rounded-2xl border p-3 transition-all ${
                    isSelected
                      ? 'border-primary bg-accent shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground truncate">
                          {model.model_name}
                        </span>
                        {isSelected && (
                          <Check className="size-4 text-primary shrink-0" />
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge variant="secondary" className="font-normal">
                          {model.applicable_type || '通用'}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {model.model_id}
                        </span>
                      </div>
                      {model.formula_logic && (
                        <div className="mt-1.5 font-mono text-xs text-muted-foreground truncate">
                          {model.formula_logic}
                        </div>
                      )}
                      {isSelected && model.input_vars && model.input_vars.length > 0 && (
                        <div
                          className="mt-2.5 rounded-xl bg-card border border-gray-100 p-2.5 space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            模型参数（共 {model.input_vars.length} 项，请填写后应用）
                          </div>
                          {model.input_vars.map((v: ModelInputVar, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="font-bold text-foreground shrink-0 w-24 truncate">
                                {v.name}
                              </span>
                              <Badge variant="outline" className="font-normal text-[10px] py-0 px-1.5 shrink-0">
                                {v.type}
                              </Badge>
                              {v.required && (
                                <Badge variant="destructive" className="font-normal text-[10px] py-0 px-1.5 shrink-0">
                                  必填
                                </Badge>
                              )}
                              <Input
                                value={paramValues[v.name] ?? ''}
                                onChange={(e) => handleParamChange(v.name, e.target.value)}
                                placeholder={v.description || (v.defaultValue != null ? `默认: ${v.defaultValue}` : '请输入')}
                                className="h-7 text-xs font-mono flex-1"
                                aria-invalid={v.required && !(paramValues[v.name]?.trim())}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {isSelected && (!model.input_vars || model.input_vars.length === 0) && (
                        <div className="mt-2.5 text-xs text-muted-foreground">
                          该模型未定义参数
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-full"
          >
            取消
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedId || loading}
            className="rounded-full gap-1.5"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? '应用中...' : '应用'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModelSelectDialog;
