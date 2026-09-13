import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { settingsApi } from '@client/src/api';
import { logger } from '@client/src/common/platform/logger';
import { Settings, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

interface ProviderForm {
  apiKey: string;
  model: string;
  visionModel: string;
  baseUrl: string;
  organization?: string;
  name?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  custom: '自定义 (Ollama / vLLM)',
};

const PROVIDER_DEFAULTS: Record<string, ProviderForm> = {
  deepseek: { apiKey: '', model: 'deepseek-chat', visionModel: '', baseUrl: 'https://api.deepseek.com' },
  openai: { apiKey: '', model: 'gpt-4o-mini', visionModel: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', organization: '' },
  custom: { apiKey: '', model: '', visionModel: '', baseUrl: '', name: 'ollama' },
};

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState('mock');
  const [providers, setProviders] = useState<Record<string, ProviderForm>>({});
  const [status, setStatus] = useState<settingsApi.AIStatusResponse | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [config, statusData] = await Promise.all([
        settingsApi.getAIConfig(),
        settingsApi.getAIStatus(),
      ]);
      setDefaultProvider(config.defaultProvider);
      setStatus(statusData);

      const forms: Record<string, ProviderForm> = {};
      for (const key of Object.keys(PROVIDER_DEFAULTS)) {
        const saved = config.providers[key];
        forms[key] = {
          apiKey: saved?.apiKey ?? '',
          model: saved?.model ?? PROVIDER_DEFAULTS[key].model,
          visionModel: saved?.visionModel ?? PROVIDER_DEFAULTS[key].visionModel,
          baseUrl: saved?.baseUrl ?? PROVIDER_DEFAULTS[key].baseUrl,
          organization: saved?.organization ?? '',
          name: saved?.name ?? PROVIDER_DEFAULTS[key].name,
        };
      }
      setProviders(forms);
    } catch (err) {
      logger.error('加载 AI 配置失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMsg(null);

      const configPayload: settingsApi.AIProviderSettings = {
        defaultProvider,
        providers: {},
      };

      for (const [key, form] of Object.entries(providers)) {
        if (form.apiKey) {
          configPayload.providers[key] = {
            apiKey: form.apiKey,
            model: form.model,
            visionModel: form.visionModel || undefined,
            baseUrl: form.baseUrl,
            ...(key === 'openai' ? { organization: form.organization } : {}),
            ...(key === 'custom' ? { name: form.name } : {}),
          };
        }
      }

      await settingsApi.updateAIConfig(configPayload);
      setSaveMsg({ type: 'success', text: '配置已保存并生效' });
      await loadData();
    } catch (err) {
      logger.error('保存 AI 配置失败', err);
      setSaveMsg({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const updateProvider = (key: string, field: keyof ProviderForm, value: string) => {
    setProviders((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">AI 模型配置</h2>
        <p className="text-sm text-muted-foreground">
          配置 LLM 提供商的 API 密钥，用于 AI 智能对话和自动测算功能。
        </p>
      </div>

      {status && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">当前状态</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {status.activeAdapter && status.activeAdapter !== 'mock' ? (
                <CheckCircle2 className="size-4 text-green-500" />
              ) : (
                <AlertCircle className="size-4 text-amber-500" />
              )}
              <span className="text-sm font-medium">
                {status.activeAdapter && status.activeAdapter !== 'mock'
                  ? `已连接: ${PROVIDER_LABELS[status.activeAdapter] ?? status.activeAdapter}`
                  : '未配置真实模型（使用 Mock 兜底）'}
              </span>
            </div>
            <Badge variant="secondary" className="ml-auto text-xs">
              已注册: {status.registeredAdapters.length} 个适配器
            </Badge>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm font-medium">默认提供商</CardTitle>
          <CardDescription>选择 AI 功能默认使用的模型提供商</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={defaultProvider} onValueChange={setDefaultProvider}>
            <SelectTrigger className="w-[240px] rounded-xl">
              <SelectValue placeholder="选择提供商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deepseek">DeepSeek</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="custom">自定义 (Ollama / vLLM)</SelectItem>
              <SelectItem value="mock">Mock（测试用）</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {Object.entries(PROVIDER_DEFAULTS).map(([key, defaults]) => {
        const form = providers[key] ?? defaults;
        const isConfigured = !!form.apiKey;
        return (
          <Card key={key} className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">
                    {PROVIDER_LABELS[key] ?? key}
                  </CardTitle>
                  <CardDescription>
                    {key === 'deepseek' && '国内可直连，推荐。支持 deepseek-chat / deepseek-reasoner'}
                    {key === 'openai' && 'GPT-4o / GPT-4o-mini 等'}
                    {key === 'custom' && 'Ollama、vLLM 等 OpenAI 兼容接口'}
                  </CardDescription>
                </div>
                {isConfigured && (
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    已配置
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">API Key</Label>
                <div className="relative">
                  <Input
                    type={showKeys[key] ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={(e) => updateProvider(key, 'apiKey', e.target.value)}
                    placeholder={isConfigured ? '已配置，留空保持不变' : `输入 ${PROVIDER_LABELS[key]} API Key`}
                    className="rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey(key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys[key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">模型名称</Label>
                  <Input
                    value={form.model}
                    onChange={(e) => updateProvider(key, 'model', e.target.value)}
                    placeholder={defaults.model}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Base URL</Label>
                  <Input
                    value={form.baseUrl}
                    onChange={(e) => updateProvider(key, 'baseUrl', e.target.value)}
                    placeholder={defaults.baseUrl}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">视觉模型（图片识别）</Label>
                <Input
                  value={form.visionModel}
                  onChange={(e) => updateProvider(key, 'visionModel', e.target.value)}
                  placeholder={defaults.visionModel || '留空则使用默认'}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  需支持多模态输入的模型，如 gpt-4o、deepseek-vl2、qwen-vl 等
                </p>
              </div>

              {key === 'openai' && (
                <div className="space-y-2">
                  <Label className="text-xs">Organization（可选）</Label>
                  <Input
                    value={form.organization ?? ''}
                    onChange={(e) => updateProvider(key, 'organization', e.target.value)}
                    placeholder="org-xxx"
                    className="rounded-xl"
                  />
                </div>
              )}

              {key === 'custom' && (
                <div className="space-y-2">
                  <Label className="text-xs">适配器名称</Label>
                  <Input
                    value={form.name ?? ''}
                    onChange={(e) => updateProvider(key, 'name', e.target.value)}
                    placeholder="ollama"
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    此名称将作为 AI_DEFAULT_PROVIDER 的值使用
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        {saveMsg && (
          <div className={`text-sm ${saveMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {saveMsg.text}
          </div>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto rounded-full"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          保存配置
        </Button>
      </div>
    </div>
  );
}

export default SettingsPage;
