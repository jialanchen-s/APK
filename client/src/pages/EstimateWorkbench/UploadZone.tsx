import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Download, Trash2, Play, FolderGit2, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { createEstimateTask, getContractProjects } from '@client/src/api/estimate-task';
import { parseExcelRows } from './excel-parser';
import { parseTextRows, parseDocumentToText, parseImageToText, getFileType, type FileType } from './text-parser';
import { toast } from 'sonner';
import { logger } from '@client/src/common/platform/logger';
import { cn } from '@/lib/utils';
import type { LineType, EstimateMode, EstimateTaskRow, ArchiveDomain } from '@shared/api.interface';

interface UploadZoneProps {
  onTaskCreated: (taskId: string) => void;
  domain: ArchiveDomain;
}

const LINE_OPTIONS: { value: LineType; label: string }[] = [
  { value: '主线', label: '主线' },
  { value: '侧围线', label: '侧围线' },
  { value: '开闭件线', label: '开闭件线' },
  { value: '下车体线', label: '下车体线' },
];

const MODE_OPTIONS: { value: EstimateMode; label: string; desc: string }[] = [
  { value: 'standard', label: '目标价模式', desc: '最近2个项目最低价均价' },
  { value: 'budget', label: '预算模式', desc: '同线别最高2条均价，偏保守' },
  { value: 'project_match', label: '指定项目匹配', desc: '仅在选定历史项目范围内匹配均价' },
];

const TEMPLATE_HEADERS = [
  '序号', '工位号', '工位描述', '设备/材料名称', '类别', '区分',
  '供货', '复制/镜像', '规格/备注', '数量', '单位', '单价（未税）/元', '总价（未税）/元', '备注',
];

const TEMPLATE_SAMPLE_ROWS: (string | number)[][] = [
  [1, 'WS001', '底盘焊接工位', '前桥总成', '专用', '新增', '乙供', '原创', '规格说明示例', 2, '台', '', '', ''],
  [2, 'WS002', '底盘焊接工位', '后桥总成', '专用', '新增', '乙供', '复制', '规格说明示例', 2, '台', '', '', ''],
  [3, 'WS003', '侧围焊接工位', '侧围外板', '专用', '改造-小', '乙供', '镜像', '规格说明示例', 4, '件', '', '', ''],
];

function downloadTemplate() {
  const titleRow = ['XX项目xx线体预算清单', '', '', '', '', '', '', '', '', '', '', '', '', ''];
  const aoa = [titleRow, TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }];
  ws['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 20 }, { wch: 24 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 40 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '预算清单');
  XLSX.writeFile(wb, '预算清单模板.xlsx');
}

const UploadZone = ({ onTaskCreated, domain }: UploadZoneProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lineType, setLineType] = useState<LineType>('主线');
  const [estimateMode, setEstimateMode] = useState<EstimateMode>('standard');
  const [projectList, setProjectList] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [fileType, setFileType] = useState<FileType>('excel');

  const refreshProjectList = useCallback(() => {
    getContractProjects(domain)
      .then((res) => setProjectList(res.projects))
      .catch((err) => logger.warn('获取项目列表失败', err));
  }, [domain]);

  useEffect(() => { refreshProjectList(); }, [refreshProjectList]);

  const toggleProject = (p: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      const detectedType = getFileType(file);
      setFileType(detectedType);
      setFileName(file.name);
      setSelectedFile(file);
    },
    [],
  );

  const handleDeleteFile = () => {
    setSelectedFile(null);
    setFileName(null);
  };

  const handleStart = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      let rows: EstimateTaskRow[] = [];

      if (fileType === 'excel') {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetData = XLSX.utils.sheet_to_json<(string | number)[]>(
          firstSheet,
          { header: 1, defval: '' },
        );
        rows = parseExcelRows(sheetData, lineType);
      } else if (fileType === 'document') {
        const text = await parseDocumentToText(selectedFile);
        rows = parseTextRows(text, lineType);
      } else {
        const text = await parseImageToText(selectedFile);
        rows = parseTextRows(text, lineType);
      }

      if (rows.length === 0) {
        toast.error('解析失败', {
          description: '未识别到有效数据行，请检查文件内容是否包含设备清单',
        });
        setUploading(false);
        return;
      }

      toast.success('解析成功', {
        description: `共识别 ${rows.length} 行数据，开始测算...`,
      });

      if (estimateMode === 'project_match' && selectedProjects.size === 0) {
        toast.error('请先选择历史项目', {
          description: '指定项目匹配模式需要至少选择一个项目',
        });
        setUploading(false);
        return;
      }

      const result = await createEstimateTask({
        file_name: selectedFile.name,
        line_type: lineType,
        domain,
        estimate_mode: estimateMode,
        target_projects: estimateMode === 'project_match' ? Array.from(selectedProjects) : undefined,
        rows,
      });

      onTaskCreated(result.id);
    } catch (err) {
      logger.error('文件上传解析失败:', JSON.stringify(err));
      toast.error('上传失败', {
        description: '文件解析或提交出错，请重试',
      });
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    multiple: false,
    disabled: uploading || !!selectedFile,
  });

  return (
    <Card className="rounded-3xl shadow-sm border border-gray-100">
      {/* 产线选择（仅焊装） + 测算模式 + 模板下载 */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          {domain === 'welding' && (
            <>
              <span className="text-sm font-medium text-foreground">选择产线</span>
              <Select
            value={lineType}
            onValueChange={(v) => setLineType(v as LineType)}
            disabled={uploading}
          >
            <SelectTrigger className="w-32 h-8 rounded-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {LINE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm rounded-xl">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
            </>
          )}
          <span className="text-sm font-medium text-foreground">测算模式</span>
          <Select
            value={estimateMode}
            onValueChange={(v) => setEstimateMode(v as EstimateMode)}
            disabled={uploading}
          >
            <SelectTrigger className="w-36 h-8 rounded-full text-sm">
              {MODE_OPTIONS.find((o) => o.value === estimateMode)?.label ?? '选择模式'}
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {MODE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm rounded-xl" textValue={opt.label}>
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.desc}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {estimateMode === 'project_match' && (
            <Popover open={projectPopoverOpen} onOpenChange={(open) => { setProjectPopoverOpen(open); if (open) refreshProjectList(); }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading || projectList.length === 0}
                  className="h-8 rounded-full gap-1.5 max-w-[280px]"
                >
                  <FolderGit2 className="size-4 shrink-0" />
                  {selectedProjects.size > 0 ? (
                    <span className="truncate">已选 {selectedProjects.size} 个项目</span>
                  ) : (
                    <span className="text-muted-foreground truncate">选择历史项目</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 rounded-2xl" align="start">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-bold">选择历史项目</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setSelectedProjects(new Set(projectList))}
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:underline"
                      onClick={() => setSelectedProjects(new Set())}
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="max-h-[260px] overflow-y-auto py-1">
                  {projectList.map((p) => {
                    const checked = selectedProjects.has(p);
                    return (
                      <label
                        key={p}
                        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={(e) => { e.preventDefault(); toggleProject(p); }}
                      >
                        <Checkbox checked={checked} />
                        <span className="text-sm truncate flex-1">{p}</span>
                        {checked && <Check className="size-3.5 text-primary shrink-0" />}
                      </label>
                    );
                  })}
                </div>
                {selectedProjects.size > 0 && (
                  <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-1">
                    {Array.from(selectedProjects).slice(0, 3).map((p) => (
                      <Badge key={p} variant="secondary" className="text-[10px] font-normal">
                        {p}
                      </Badge>
                    ))}
                    {selectedProjects.size > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{selectedProjects.size - 3}
                      </span>
                    )}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={downloadTemplate}
          disabled={uploading}
        >
          <Download className="size-4" />
          下载模板
        </Button>
      </div>

      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={cn(
            'flex flex-col items-center justify-center gap-4 p-10 cursor-pointer transition-all',
            isDragActive
              ? 'bg-primary/5 border-2 border-dashed border-primary rounded-3xl'
              : 'hover:bg-accent/30',
            uploading && 'cursor-wait opacity-70',
          )}
        >
          <input {...getInputProps()} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'flex size-16 items-center justify-center rounded-2xl',
              isDragActive ? 'bg-primary/10' : 'bg-accent',
            )}
          >
            {uploading ? (
              <Loader2 className="size-7 animate-spin text-primary" />
            ) : (
              <Upload
                className={cn(
                  'size-7',
                  isDragActive ? 'text-primary' : 'text-muted-foreground',
                )}
              />
            )}
          </motion.div>

          <div className="text-center">
            <p className="text-base font-medium text-foreground">
              {uploading
                ? (fileType === 'excel' ? '正在解析并提交测算...' : '正在解析文件...')
                : isDragActive
                  ? '释放文件即可上传'
                  : '拖拽文件到此处，或点击选择文件'}
            </p>
          <p className="mt-1 text-sm text-muted-foreground">
            支持 .xlsx / .xls / .pdf / .doc / .docx / 图片格式，需包含：工位号、设备/材料名称、类别、区分、供货、数量、单位
          </p>
          </div>

          {!uploading && (
            <Button variant="outline" size="sm" className="mt-2 rounded-full">
              <FileSpreadsheet className="size-4" />
              选择文件
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between rounded-2xl bg-accent/40 px-5 py-4">
            <div className="flex items-center gap-3">
              {fileType === 'image' && <ImageIcon className="size-5 text-primary" />}
              {fileType === 'document' && <FileText className="size-5 text-primary" />}
              {fileType === 'excel' && <FileSpreadsheet className="size-5 text-primary" />}
              <div>
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  产线：{lineType} · 模式：{MODE_OPTIONS.find((o) => o.value === estimateMode)?.label} · 点击开始测算
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground hover:text-destructive"
              onClick={handleDeleteFile}
              disabled={uploading}
            >
              <Trash2 className="size-4" />
              删除
            </Button>
          </div>

          <Button
            className="w-full rounded-full"
            size="lg"
            onClick={handleStart}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                测算中...
              </>
            ) : (
              <>
                <Play className="size-4" />
                开始测算
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default UploadZone;
