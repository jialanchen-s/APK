import { useModelStudio } from './useModelStudio';
import ModelListPanel from './ModelListPanel';
import ModelEditor from './ModelEditor';
import TryoutPanel from './TryoutPanel';

const ModelStudio = () => {
  const {
    models,
    loading,
    selectedId,
    editor,
    tryoutResult,
    tryoutLoading,
    tryoutPassed,
    setEditor,
    handleSelect,
    handleNewModel,
    handleSave,
    handleDelete,
    handleTryout,
    handlePublish,
  } = useModelStudio();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <ModelListPanel
        models={models}
        loading={loading}
        selectedId={selectedId}
        onNew={handleNewModel}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />
      <ModelEditor editor={editor} setEditor={setEditor} onSave={handleSave} />
      <TryoutPanel
        editor={editor}
        tryoutResult={tryoutResult}
        tryoutLoading={tryoutLoading}
        tryoutPassed={tryoutPassed}
        onTryout={handleTryout}
        onPublish={handlePublish}
      />
    </div>
  );
};

export default ModelStudio;
