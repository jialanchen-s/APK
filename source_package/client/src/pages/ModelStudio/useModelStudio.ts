import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import * as modelApi from '@client/src/api/model';
import type {
  ModelItem,
  ModelInputVar,
  SaveModelRequest,
  TryoutResponse,
} from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

export interface EditorState {
  id?: string;
  model_name: string;
  applicable_type: string;
  input_vars: ModelInputVar[];
  formula_logic: string;
  constants: Record<string, string | number>;
}

export const EMPTY_MODEL: EditorState = {
  model_name: '',
  applicable_type: '',
  input_vars: [],
  formula_logic: '',
  constants: {},
};

interface UseModelStudioReturn {
  models: ModelItem[];
  loading: boolean;
  selectedId: string | null;
  editor: EditorState;
  tryoutResult: TryoutResponse | null;
  tryoutLoading: boolean;
  tryoutPassed: boolean;
  versions: ModelItem['input_vars'];
  setSelectedId: (id: string | null) => void;
  setEditor: React.Dispatch<React.SetStateAction<EditorState>>;
  refreshModels: () => Promise<void>;
  handleSelect: (model: ModelItem) => void;
  handleNewModel: () => void;
  handleSave: () => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleTryout: (params: Record<string, string | number>) => Promise<void>;
  handlePublish: () => Promise<void>;
}

export function useModelStudio(): UseModelStudioReturn {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(EMPTY_MODEL);
  const [tryoutResult, setTryoutResult] = useState<TryoutResponse | null>(null);
  const [tryoutLoading, setTryoutLoading] = useState(false);
  const [tryoutPassed, setTryoutPassed] = useState(false);

  const refreshModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await modelApi.getModels(1, 100);
      setModels(res.items);
    } catch (err) {
      logger.error('加载模型列表失败:', JSON.stringify(err));
      toast.error('加载模型列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  const handleSelect = useCallback((model: ModelItem) => {
    setSelectedId(model.id);
    setEditor({
      id: model.id,
      model_name: model.model_name,
      applicable_type: model.applicable_type,
      input_vars: model.input_vars,
      formula_logic: model.formula_logic,
      constants: model.constants,
    });
    setTryoutResult(null);
    setTryoutPassed(false);
  }, []);

  const handleNewModel = useCallback(() => {
    setSelectedId(null);
    setEditor(EMPTY_MODEL);
    setTryoutResult(null);
    setTryoutPassed(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editor.model_name.trim()) {
      toast.error('请输入模型名称');
      return;
    }
    const payload: SaveModelRequest = {
      id: editor.id,
      model_name: editor.model_name,
      applicable_type: editor.applicable_type,
      input_vars: editor.input_vars,
      formula_logic: editor.formula_logic,
      constants: editor.constants,
    };
    try {
      const res = await modelApi.saveModel(payload);
      toast.success('保存成功');
      await refreshModels();
      if (!editor.id) {
        const created = (await modelApi.getModels(1, 100)).items.find(
          (m) => m.id === res.id,
        );
        if (created) {
          setSelectedId(res.id);
          setEditor((prev) => ({ ...prev, id: res.id }));
        }
      }
    } catch (err) {
      logger.error('保存模型失败:', JSON.stringify(err));
      toast.error('保存失败');
    }
  }, [editor, refreshModels]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await modelApi.deleteModel(id);
      toast.success('模型已删除');
      if (selectedId === id) {
        setSelectedId(null);
        setEditor(EMPTY_MODEL);
        setTryoutResult(null);
        setTryoutPassed(false);
      }
      await refreshModels();
    } catch (err) {
      logger.error('删除模型失败:', JSON.stringify(err));
      toast.error('删除失败');
    }
  }, [selectedId, refreshModels]);

  const handleTryout = useCallback(
    async (params: Record<string, string | number>) => {
      if (!editor.id) {
        toast.error('请先保存模型');
        return;
      }
      setTryoutLoading(true);
      setTryoutResult(null);
      try {
        const res = await modelApi.tryoutModel(editor.id, { params });
        setTryoutResult(res);
        setTryoutPassed(res.success);
      } catch (err) {
        logger.error('试算失败:', JSON.stringify(err));
        setTryoutResult({ success: false, error: '试算请求异常' });
        setTryoutPassed(false);
      } finally {
        setTryoutLoading(false);
      }
    },
    [editor.id],
  );

  const handlePublish = useCallback(async () => {
    if (!editor.id) {
      toast.error('请先保存模型');
      return;
    }
    try {
      const res = await modelApi.publishModel(editor.id);
      if (res.success) {
        toast.success(`发布成功，版本号 ${res.version}`);
        await refreshModels();
        setTryoutPassed(false);
      } else {
        toast.error('发布失败，请检查公式');
      }
    } catch (err) {
      logger.error('发布失败:', JSON.stringify(err));
      toast.error('发布失败');
    }
  }, [editor.id, refreshModels]);

  return {
    models,
    loading,
    selectedId,
    editor,
    tryoutResult,
    tryoutLoading,
    tryoutPassed,
    versions: [],
    setSelectedId,
    setEditor,
    refreshModels,
    handleSelect,
    handleNewModel,
    handleSave,
    handleDelete,
    handleTryout,
    handlePublish,
  };
}
