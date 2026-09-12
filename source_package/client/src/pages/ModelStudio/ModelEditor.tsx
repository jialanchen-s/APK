import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, Variable, FunctionSquare, CheckCircle2, XCircle, Settings } from 'lucide-react';
import type { EditorState } from './useModelStudio';
import type { ModelInputVar } from '@shared/api.interface';

interface ModelEditorProps {
  editor: EditorState;
  setEditor: React.Dispatch<React.SetStateAction<EditorState>>;
  onSave: () => void;
}

const ModelEditor: React.FC<ModelEditorProps> = ({ editor, setEditor, onSave }) => {
  const updateField = <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setEditor((prev) => ({ ...prev, [key]: value }));
  };

  const addParam = () => {
    const newVar: ModelInputVar = {
      name: `param${editor.input_vars.length + 1}`,
      type: 'number',
      required: false,
      description: '',
    };
    updateField('input_vars', [...editor.input_vars, newVar]);
  };

  const updateParam = (index: number, patch: Partial<ModelInputVar>) => {
    updateField(
      'input_vars',
      editor.input_vars.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    );
  };

  const removeParam = (index: number) => {
    updateField(
      'input_vars',
      editor.input_vars.filter((_, i) => i !== index),
    );
  };

  // 语法检查：检测公式中引用的变量是否都已定义（包括参数和常量）
  const varRefs: string[] = editor.formula_logic.match(/@[\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*/g) ?? [];
  const definedNames = new Set([
    ...editor.input_vars.map((v) => v.name),
    ...Object.keys(editor.constants),
  ]);
  const undefinedVars = varRefs.filter((ref: string) => !definedNames.has(ref.slice(1)));
  const hasFormula = editor.formula_logic.trim() !== '';
  const syntaxOk = hasFormula && undefinedVars.length === 0;
  const syntaxError = !hasFormula
    ? '公式为空'
    : undefinedVars.length > 0
      ? `未定义变量: ${[...new Set(undefinedVars)].join(', ')}`
      : '';

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      {/* 参数定义区 */}
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Variable className="size-4 text-primary" />
          <span className="text-sm font-bold tracking-tight text-foreground">参数定义</span>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">模型名称</Label>
            <Input
              value={editor.model_name}
              onChange={(e) => updateField('model_name', e.target.value)}
              placeholder="输入模型名称"
              className="h-8 w-56"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">适用设备类型</Label>
            <Input
              value={editor.applicable_type}
              onChange={(e) => updateField('applicable_type', e.target.value)}
              placeholder="如：焊接机器人"
              className="h-8 w-56"
            />
          </div>
        </div>

        {/* 参数列表 */}
        <div className="rounded-3xl border border-gray-100 shadow-sm">
          <div className="grid grid-cols-[1fr_120px_60px_1fr_40px] items-center gap-2 border-b border-border bg-accent/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span>变量名</span>
            <span>类型</span>
            <span className="text-center">必填</span>
            <span>描述</span>
            <span></span>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {editor.input_vars.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                暂无参数，点击下方按钮添加
              </div>
            ) : (
              editor.input_vars.map((v, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_120px_60px_1fr_40px] items-center gap-2 border-b border-border/50 px-3 py-1.5 last:border-b-0"
                >
                  <Input
                    value={v.name}
                    onChange={(e) => updateParam(i, { name: e.target.value })}
                    className="h-7 font-mono text-xs"
                    placeholder="变量名"
                  />
                  <Select
                    value={v.type}
                    onValueChange={(val) => updateParam(i, { type: val })}
                  >
                    <SelectTrigger className="h-7 text-xs" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="string">string</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={v.required}
                      onCheckedChange={(val) => updateParam(i, { required: val === true })}
                    />
                  </div>
                  <Input
                    value={v.description ?? ''}
                    onChange={(e) => updateParam(i, { description: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="参数说明"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => removeParam(i)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={addParam} data-ai-section-type="button">
            <Plus className="size-3.5" />
            添加参数
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="default"
            size="sm"
            className="rounded-full"
            onClick={onSave}
            disabled={!editor.model_name.trim()}
            data-ai-section-type="button"
          >
            <Save className="size-3.5" />
            保存草稿
          </Button>
          {editor.id && (
            <span className="font-mono text-[10px] text-muted-foreground">ID: {editor.id.slice(0, 8)}...</span>
          )}
        </div>
      </div>

      {/* 常量设置区 */}
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-primary" />
          <span className="text-sm font-bold tracking-tight text-foreground">常量设置</span>
          <span className="text-[11px] text-muted-foreground">
            公式中引用的固定值（如人工费率、钢材单价等）
          </span>
        </div>

        <div className="rounded-3xl border border-gray-100 shadow-sm">
          <div className="grid grid-cols-[1fr_120px_40px] items-center gap-2 border-b border-border bg-accent/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span>常量名</span>
            <span>数值</span>
            <span></span>
          </div>
          <div className="max-h-[120px] overflow-y-auto">
            {Object.keys(editor.constants).length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                暂无常量，点击下方按钮添加（如：人工费率、回收抵扣率、钢材单价）
              </div>
            ) : (
              Object.entries(editor.constants).map(([key, value], i) => (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_120px_40px] items-center gap-2 border-b border-border/50 px-3 py-1.5 last:border-b-0"
                >
                  <Input
                    value={key}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      const newConstants = { ...editor.constants };
                      delete newConstants[key];
                      newConstants[newKey] = value;
                      updateField('constants', newConstants);
                    }}
                    className="h-7 font-mono text-xs"
                    placeholder="常量名"
                  />
                  <Input
                    value={String(value)}
                    onChange={(e) => {
                      const numValue = parseFloat(e.target.value);
                      updateField('constants', {
                        ...editor.constants,
                        [key]: isNaN(numValue) ? e.target.value : numValue,
                      });
                    }}
                    className="h-7 text-xs"
                    placeholder="数值"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const newConstants = { ...editor.constants };
                      delete newConstants[key];
                      updateField('constants', newConstants);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              const newKey = `const${Object.keys(editor.constants).length + 1}`;
              updateField('constants', { ...editor.constants, [newKey]: 0 });
            }}
            data-ai-section-type="button"
          >
            <Plus className="size-3.5" />
            添加常量
          </Button>
        </div>
      </div>

      {/* 公式编辑区 */}
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        <div className="mb-2 flex items-center gap-2">
          <FunctionSquare className="size-4 text-primary" />
          <span className="text-sm font-bold tracking-tight text-foreground">公式编辑</span>
          <span className="text-[11px] text-muted-foreground">
            用 @变量名 引用参数或常量，支持 + - * / 和 max / min / abs
          </span>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-gray-100 shadow-sm">
          <Textarea
            value={editor.formula_logic}
            onChange={(e) => updateField('formula_logic', e.target.value)}
            placeholder="示例：@weight * @unit_price + max(@surcharge, 0)"
            className="min-h-full flex-1 resize-none rounded-none border-0 bg-[#1E1E1E] font-mono text-sm text-gray-100 placeholder:text-gray-500 focus-visible:ring-0 focus-visible:border-0"
          />
          <div className="flex items-center justify-between border-t border-border bg-card px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              {varRefs.length > 0 && (
                <>引用变量: {[...new Set(varRefs)].join(' ')}</>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              {syntaxOk ? (
                <>
                  <CheckCircle2 className="size-3.5 text-[hsl(94_60%_48%)]" />
                  <span className="text-[11px] text-[hsl(94_60%_48%)]">语法正确</span>
                </>
              ) : (
                <>
                  <XCircle className="size-3.5 text-destructive" />
                  <span className="text-[11px] text-destructive">{syntaxError}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelEditor;
