import { useState, useCallback, useEffect } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Upload, AlertTriangle, Archive, FileSpreadsheet, Loader2, Layers, AlertCircle, X, RotateCcw, Download, FileCheck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logger } from '@client/src/common/platform/logger';
import {
  parseContract,
  getContractPreview,
  archiveContracts,
  getArchiveLogs,
} from '@/api/contract';
import type {
  ContractRow,
  ContractPreviewItem,
  ContractPreviewItemUnion,
  ContractParseResponse,
  ContractArchiveLog,
  LineType,
  UsageScope,
  ModifyLevel,
  CopyMode,
  PriceCaliber,
  SupplyType,
  ArchiveDomain,
  ManufacturingContractRow,
  ContractRowUnion,
} from '@shared/api.interface';
import { Can } from '@client/src/common/platform/auth';
import { cn } from '@/lib/utils';
import { parseContractFile } from './pdf-parser';
import ContractPreviewTable from './ContractPreviewTable';
import ContractArchiveLogs from './ContractArchiveLogs';
import ArchivedDataTable from './ArchivedDataTable';
import ContractReviewPanel from './ContractReviewPanel';
import SubmissionStatusCard from './SubmissionStatusCard';

const DOMAIN_OPTIONS: { value: ArchiveDomain; label: string }[] = [
  { value: 'welding', label: '焊装合同库' },
  { value: 'manufacturing', label: '总装费用合同库' },
  { value: 'painting', label: '涂装费用合同库' },
  { value: 'stamping', label: '冲压费用合同库' },
];

const PAGE_SIZE = 10;
const PREVIEW_FETCH_SIZE = 9999;

interface ConfirmFileForm {
  project: string;
  settleDate: string;
  lineType: string;
  projectTime: string;
  factoryName: string;
}

const EMPTY_CONFIRM_FILE_FORM: ConfirmFileForm = {
  project: '',
  settleDate: '',
  lineType: '',
  projectTime: '',
  factoryName: '',
};

const LINE_TYPE_KEYWORDS: { type: LineType; keywords: string[] }[] = [
  { type: '侧围线', keywords: ['侧围'] },
  { type: '开闭件线', keywords: ['开闭'] },
  { type: '下车体线', keywords: ['下车体'] },
  { type: '主线', keywords: ['主线'] },
];

function detectLineType(fileName: string): LineType | null {
  const name = fileName.toLowerCase();
  for (const { type, keywords } of LINE_TYPE_KEYWORDS) {
    if (keywords.some((kw) => name.includes(kw.toLowerCase()))) {
      return type;
    }
  }
  return null;
}

function getCellValue(row: Record<string, unknown>, key: string): string {
  const keys = Object.keys(row);
  const matchedKey = keys.find(k => k.trim() === key) ||
    keys.find(k => k.trim().replace(/\s/g, '') === key.replace(/\s/g, '')) ||
    keys.find(k => k.includes(key) || key.includes(k.trim()));
  const val = matchedKey ? row[matchedKey] : row[key];
  if (val == null) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).trim();
}

const ContractArchive = () => {
  const [parsing, setParsing] = useState(false);
  const [parseProgressText, setParseProgressText] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<ContractParseResponse | null>(null);
  const [filePreviews, setFilePreviews] = useState<{ sourceFile: string; previewId: string; count: number; validCount: number }[]>([]);
  const [previewItems, setPreviewItems] = useState<ContractPreviewItemUnion[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmFileForms, setConfirmFileForms] = useState<Record<string, ConfirmFileForm>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showInvalidDialog, setShowInvalidDialog] = useState(false);
  const [invalidPage, setInvalidPage] = useState(1);
  const INVALID_PAGE_SIZE = 10;
  const [logs, setLogs] = useState<ContractArchiveLog[]>([]);
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);
  const [domain, setDomain] = useState<ArchiveDomain>('welding');

  useEffect(() => {
    void loadLogs(domain);
  }, [domain]);

  const handleDownloadTemplate = () => {
    const headers = domain !== 'welding'
      ? ['设备/材料名称', '项目', '规格型号', '单价(元,未税)', '单位', '数量', '小计(未税)/元', '选定品牌', '结算日', '备注']
      : [
        '设备/材料名称', '项目', '类别', '区分', '复制/镜像',
        '单价(元,未税)', '单位', '数量', '小计(未税)/元',
        '供货', '选定品牌', '结算日', '工位号', '工位描述', '备注',
      ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '合同数据');
    XLSX.writeFile(wb, `${domain !== 'welding' ? DOMAIN_OPTIONS.find((o) => o.value === domain)?.label.replace('合同库', '') ?? '焊装' : '焊装'}合同归档模板.xlsx`);
  };

  const loadLogs = async (targetDomain: ArchiveDomain) => {
    try {
      const res = await getArchiveLogs(5, targetDomain);
      setLogs(res.logs);
    } catch (err) {
      logger.error('加载归档日志失败:', JSON.stringify(err));
    }
  };

  const parseExcelFile = useCallback(async (file: File, lineType: LineType): Promise<ContractRow[]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (rawData.length === 0) return [];

    return rawData.map((row) => {
      const deviceName = getCellValue(row, '设备/材料名称') || getCellValue(row, '设备名称');
      if (!deviceName) return null;

      const priceStr =
        getCellValue(row, '单价(元,未税)') ||
        getCellValue(row, '单价(元 含税)') ||
        getCellValue(row, '单价(元,含税)') ||
        getCellValue(row, '单价');
      const unitPrice = parseFloat(priceStr.replace(/,/g, '').replace(/\s/g, '')) || 0;

      const supplyVal = getCellValue(row, '供货') || getCellValue(row, '供货方式');
      const category = getCellValue(row, '类别') || getCellValue(row, '规格');
      const distinction = getCellValue(row, '区分');
      const isTaxIncluded =
        getCellValue(row, '单价(元 含税)') ||
        getCellValue(row, '单价(元,含税)');

      const quantityStr = getCellValue(row, '数量');
      const subtotalStr = getCellValue(row, '小计(未税)/元') || getCellValue(row, '小计（含税）/元') || getCellValue(row, '小计');

      const result: ContractRow = {
        project: getCellValue(row, '项目') || getCellValue(row, '项目编号'),
        line_type: lineType,
        device_material_name: deviceName,
        usage_scope: category ? (category === '通用' ? '通用' : '专用') as UsageScope : undefined,
        distinction: (distinction || undefined) as ModifyLevel | undefined,
        copy_mode: (getCellValue(row, '复制/镜像') || undefined) as CopyMode | undefined,
        unit_price: unitPrice,
        price_caliber: (isTaxIncluded ? '含税' : '未税') as PriceCaliber,
        supply: (supplyVal || undefined) as SupplyType | undefined,
        unit: getCellValue(row, '单位') || undefined,
        settle_date: getCellValue(row, '结算日') || getCellValue(row, '结算日期'),
        quantity: quantityStr ? parseFloat(quantityStr) || undefined : undefined,
        selected_brand: getCellValue(row, '选定品牌') || undefined,
        subtotal: subtotalStr ? parseFloat(subtotalStr.replace(/,/g, '')) || undefined : undefined,
        remark: getCellValue(row, '备注') || undefined,
        workstation_no: getCellValue(row, '工位号') || getCellValue(row, '工位编号') || getCellValue(row, '工位') || undefined,
        workstation_desc: getCellValue(row, '工位描述') || getCellValue(row, '工位说明') || undefined,
      };
      if (category) result.category = category;
      return result;
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, []);

  const parseExcelManufacturingFile = useCallback(async (file: File): Promise<ManufacturingContractRow[]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (rawData.length === 0) return [];

    return rawData.map((row): ManufacturingContractRow | null => {
      const deviceName = getCellValue(row, '设备/材料名称')
        || getCellValue(row, '设备名称')
        || getCellValue(row, '费用项目');
      if (!deviceName) return null;

      const priceStr =
        getCellValue(row, '单价(元,未税)') ||
        getCellValue(row, '单价(元 含税)') ||
        getCellValue(row, '单价(元,含税)') ||
        getCellValue(row, '单价') ||
        getCellValue(row, '价格');
      const unitPrice = parseFloat(priceStr.replace(/,/g, '').replace(/\s/g, '')) || 0;
      const isTaxIncluded =
        getCellValue(row, '单价(元 含税)') ||
        getCellValue(row, '单价(元,含税)');
      const quantityStr = getCellValue(row, '数量');
      const subtotalStr = getCellValue(row, '小计(未税)/元') || getCellValue(row, '小计（含税）/元') || getCellValue(row, '小计');

      return {
        project: getCellValue(row, '项目') || getCellValue(row, '项目名称'),
        device_material_name: deviceName,
        specification: getCellValue(row, '规格型号') || getCellValue(row, '规格') || getCellValue(row, '技术参数') || undefined,
        unit_price: unitPrice,
        price_caliber: (isTaxIncluded ? '含税' : '未税') as PriceCaliber,
        unit: getCellValue(row, '单位') || undefined,
        settle_date: getCellValue(row, '结算日') || getCellValue(row, '结算日期'),
        quantity: quantityStr ? parseFloat(quantityStr) || undefined : undefined,
        selected_brand: getCellValue(row, '选定品牌') || getCellValue(row, '供应商') || getCellValue(row, '品牌') || undefined,
        subtotal: subtotalStr ? parseFloat(subtotalStr.replace(/,/g, '')) || undefined : undefined,
        remark: getCellValue(row, '备注') || undefined,
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
    if (fileRejections.some((r) => r.errors.some((e) => e.code === 'too-many-files'))) {
      toast.error('单次最多上传 4 个文件', {
        description: '请分批上传，避免一次性提交过多表格',
      });
    }
    if (acceptedFiles.length === 0) return;
      const currentDomain = domain;

      setParsing(true);
      try {
        const allItems: ContractPreviewItemUnion[] = [];
      const newFilePreviews: { sourceFile: string; previewId: string; count: number; validCount: number }[] = [];
      let emptyCount = 0;
      let totalCount = 0;
      let totalValid = 0;

      for (const file of acceptedFiles) {
        const detected = detectLineType(file.name);
        const lineType: LineType | undefined = currentDomain !== 'welding' ? undefined : (detected ?? '主线');
        if (currentDomain === 'welding' && !detected) {
          toast.info(`${file.name} 未识别到线别，已默认使用「主线」`);
        }

        let rows: ContractRowUnion[];
        const lowerName = file.name.toLowerCase();
        const isPdfOrImage = lowerName.endsWith('.pdf')
          || /\.(png|jpe?g|webp)$/.test(lowerName);
        if (isPdfOrImage) {
          rows = await parseContractFile(file, lineType, currentDomain, (progress) => {
            if (progress.stage === 'parsing') {
              setParseProgressText('正在解析文件内容…');
            } else if (progress.stage === 'extracting') {
              setParseProgressText(`正在识别合同明细（${progress.done ?? 0}/${progress.total ?? 0} 片）…`);
            } else {
              setParseProgressText('正在上传文件…');
            }
          });
        } else {
          if (currentDomain !== 'welding') {
            rows = await parseExcelManufacturingFile(file);
          } else {
            rows = await parseExcelFile(file, lineType ?? '主线');
          }
        }

        if (rows.length === 0) {
          emptyCount += 1;
          continue;
        }

        const result = await parseContract({
            file_name: file.name,
            rows,
            domain: currentDomain,
          });

        let preview;
        try {
          preview = await getContractPreview(result.previewId, 1, PREVIEW_FETCH_SIZE);
        } catch (previewErr) {
          logger.error('预览加载失败，重试中:', JSON.stringify(previewErr));
          await new Promise((r) => setTimeout(r, 500));
          preview = await getContractPreview(result.previewId, 1, PREVIEW_FETCH_SIZE);
        }

         allItems.push(...preview.items);
        newFilePreviews.push({
          sourceFile: file.name,
          previewId: result.previewId,
          count: result.totalCount,
          validCount: result.validCount,
        });
        totalCount += result.totalCount;
        totalValid += result.validCount;
      }

      if (allItems.length === 0) {
        toast.error('所有文件均未识别出有效数据行，请检查文件内容或格式');
        return;
      }

      const batchName = newFilePreviews.length === 1
        ? newFilePreviews[0].sourceFile
        : `${newFilePreviews.length} 个文件 · 共 ${totalCount} 条`;

      setParseResult({
        previewId: '',
        totalCount,
        validCount: totalValid,
        invalidCount: totalCount - totalValid,
      });
      setFilePreviews(newFilePreviews);
      setFileName(batchName);
      setPreviewItems(allItems);
      setCurrentPage(1);

      const summary = newFilePreviews.map(s => `${s.sourceFile}（${s.count}条）`).join('、');
      toast.success(
        `解析完成：${newFilePreviews.length} 个文件，共 ${totalCount} 条，有效 ${totalValid} 条，异常 ${totalCount - totalValid} 条${emptyCount > 0 ? `，${emptyCount} 个文件无数据` : ''}`,
        { description: summary, duration: 4000 },
      );
    } catch (err) {
      logger.error('解析或预览失败:', JSON.stringify(err));
      const msg = err instanceof Error ? err.message : '操作失败，请重试或检查文件格式';
      toast.error(msg);
    } finally {
      setParsing(false);
      setParseProgressText('');
    }
  }, [domain, parseExcelFile]);

  const handleDeleteRow = (id: string) => {
    setPreviewItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      const newTotalPages = Math.ceil(next.length / PAGE_SIZE) || 1;
      if (currentPage > newTotalPages) {
        setCurrentPage(newTotalPages);
      }
      return next;
    });
  };

  const handleDeleteFile = (sourceFile: string) => {
    setPreviewItems((prev) => {
      const next = prev.filter((i) => i.source_file !== sourceFile);
      const newTotalPages = Math.ceil(next.length / PAGE_SIZE) || 1;
      if (currentPage > newTotalPages) {
        setCurrentPage(newTotalPages);
      }
      return next;
    });
    setFilePreviews((prev) => prev.filter((f) => f.sourceFile !== sourceFile));
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      let totalArchived = 0;
      for (const fp of filePreviews) {
        const form = confirmFileForms[fp.sourceFile] ?? EMPTY_CONFIRM_FILE_FORM;
        const overrides: { projectName?: string; settleDate?: string; lineType?: string; projectTime?: string; factoryName?: string } = {};
        const trimmedProject = form.project.trim();
        const trimmedDate = form.settleDate.trim();
        const trimmedLineType = form.lineType.trim();
        const trimmedProjectTime = form.projectTime.trim();
        const trimmedFactoryName = form.factoryName.trim();
        if (trimmedProject) overrides.projectName = trimmedProject;
        if (trimmedDate) overrides.settleDate = trimmedDate;
        if (trimmedLineType) overrides.lineType = trimmedLineType;
        if (trimmedProjectTime) overrides.projectTime = trimmedProjectTime;
        if (trimmedFactoryName) overrides.factoryName = trimmedFactoryName;
        const fileItems = previewItems.filter((i) => i.source_file === fp.sourceFile);
        const itemIds = fileItems.map((i) => i.id);
        if (itemIds.length === 0) continue;
        const res = await archiveContracts({ previewId: fp.previewId, itemIds, ...overrides });
        totalArchived += res.archivedCount;
      }
      toast.success(`已提交审核，共 ${totalArchived} 条数据等待管理员审核通过后生效`);
      setFilePreviews([]);
      setPreviewItems([]);
      setParseResult(null);
      setFileName('');
      setShowConfirm(false);
      setCurrentPage(1);
      setArchiveRefreshKey((k) => k + 1);
      await loadLogs(domain);
    } catch (err) {
      logger.error('提交审核失败:', JSON.stringify(err));
      toast.error('提交审核失败，请重试');
    } finally {
      setArchiving(false);
    }
  };

  const validCount = previewItems.filter((i) => i.status === 'valid').length;
  const invalidItems = previewItems.filter((i) => i.status === 'invalid');
  const invalidCount = invalidItems.length;

  const openConfirmDialog = () => {
    const forms: Record<string, ConfirmFileForm> = {};
    for (const fp of filePreviews) {
      const validItems = previewItems.filter(
        (i) => i.source_file === fp.sourceFile && i.status === 'valid',
      );
      const projectSet = new Set(validItems.map((i) => i.project).filter(Boolean));
      const firstWelding = validItems.find((i): i is ContractPreviewItem => 'line_type' in i);
      forms[fp.sourceFile] = {
        project: projectSet.size === 1 ? [...projectSet][0] : '',
        lineType: firstWelding?.line_type ?? '',
        settleDate: '',
        projectTime: '',
        factoryName: '',
      };
    }
    setConfirmFileForms(forms);
    setShowConfirm(true);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxFiles: 4,
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4">
      <Can action="upload" subject="ContractArchive" fallback={null}>
      {/* Domain Selector + Upload Hint */}
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-gray-100 bg-card px-4 py-3 shadow-sm">
        <Layers className="size-5 text-primary" />
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          归档合同库
        </label>
        <Select
          value={domain}
          onValueChange={(v) => {
            if (v === domain) return;
            setDomain(v as ArchiveDomain);
             setFilePreviews([]);
             setPreviewItems([]);
            setParseResult(null);
            setFileName('');
            setCurrentPage(1);
            setArchiveRefreshKey((k) => k + 1);
          }}
        >
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {DOMAIN_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
           {domain !== 'welding'
             ? '系统将自动提取设备名称、项目、规格、价格等关键信息，写入所选费用合同库'
             : '系统将自动从文件名识别线别，数据写入对应库并按线别分类'}
         </span>
      </div>
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-8 shadow-sm transition-all hover:shadow-md',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card hover:border-primary/50',
        )}
      >
        <input {...getInputProps()} />
        {parsing ? (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {parseProgressText || '正在解析文件...'}
            </p>
            {parseProgressText ? (
              <p className="text-xs text-muted-foreground">大文件识别可能需要几分钟，请耐心等待</p>
            ) : null}
          </>
        ) : (
          <>
            <Upload className="size-8 text-muted-foreground" />
             <p className="text-sm text-muted-foreground">
               {isDragActive ? '释放文件即可上传' : '拖拽 Excel / PDF / 图片合同文件到此处，或点击选择文件（单次最多 4 个）'}
             </p>
             <div className="flex items-center gap-3">
               <p className="text-xs text-muted-foreground">
                 {domain !== 'welding'
                   ? '支持 .xlsx / .xls / .pdf（PDF 经 AI 识别提取设备/规格/价格等明细）'
                   : '支持 .xlsx / .xls / .pdf（PDF 经 AI 识别提取明细）'}
               </p>
              <span className="text-xs text-muted-foreground">·</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Download className="size-3" />
                下载归档模板
              </button>
            </div>
          </>
        )}
      </div>

      {/* Clean Rules Alert */}
      <div className="flex items-start gap-3 rounded-3xl border border-yellow-200 bg-yellow-50 px-4 py-3 shadow-sm">
        <AlertTriangle className="size-5 shrink-0 text-yellow-600" />
        <div className="text-sm">
          <p className="font-medium text-yellow-800">数据清洗规则已生效</p>
          <p className="mt-1 text-yellow-700">
            价格异常检测（&lt;0 或 &gt;10000000）· IQR剔异 · 单位换算
          </p>
        </div>
      </div>

      {/* File Info */}
      {parseResult && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="size-4" />
          <span className="truncate font-medium text-foreground">{fileName}</span>
          <span>·</span>
          <span>共 {parseResult.totalCount} 条</span>
          <span className="text-success">有效 {parseResult.validCount}</span>
          <span className="text-destructive">异常 {parseResult.invalidCount}</span>
          {invalidCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 rounded-full text-destructive hover:bg-destructive/10"
              onClick={() => setShowInvalidDialog(true)}
            >
              <AlertCircle className="mr-1 size-3.5" />
              查看异常
            </Button>
          )}
        </div>
      )}

      {/* Preview Table */}
      {previewItems.length > 0 && (
       <ContractPreviewTable
          items={previewItems}
          domain={domain}
          currentPage={currentPage}
           pageSize={PAGE_SIZE}
           onPageChange={setCurrentPage}
           onDeleteRow={handleDeleteRow}
           onDeleteFile={handleDeleteFile}
         />
      )}

      {/* Archive Confirm */}
      {previewItems.length > 0 && (
        <div className="flex items-center justify-between rounded-3xl border border-gray-100 bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md">
          <div className="text-sm text-muted-foreground">
            当前可归档{' '}
            <span className="font-mono font-medium text-foreground">{previewItems.length}</span>{' '}
            条数据
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setShowDiscardConfirm(true)}
              disabled={archiving}
            >
              <RotateCcw className="size-4" />
              放弃归档
            </Button>
            <Button
              className="rounded-full"
              onClick={() => openConfirmDialog()}
              disabled={previewItems.length === 0 || archiving}
            >
              <FileCheck className="size-4" />
              提交审核
            </Button>
          </div>
        </div>
      )}

      </Can>

      {/* Review Panel (admin only) */}
      <Can action="review" subject="ContractArchive" fallback={null}>
        <ContractReviewPanel domain={domain} />
      </Can>

      {/* Submission Status */}
      <SubmissionStatusCard refreshKey={archiveRefreshKey} domain={domain} />

      {/* Archived Data */}
      <ArchivedDataTable refreshKey={archiveRefreshKey} domain={domain} onRefresh={() => setArchiveRefreshKey((k) => k + 1)} />

      {/* Archive Logs */}
      <ContractArchiveLogs logs={logs} />

      {/* Discard Confirm Dialog */}
      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold tracking-tight">
              <AlertCircle className="size-5 text-destructive" />
              放弃归档
            </DialogTitle>
            <DialogDescription>
              将清除当前已解析的 {previewItems.length} 条预览数据，不会写入数据库。确定要放弃吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setShowDiscardConfirm(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={() => {
                 setFilePreviews([]);
                 setPreviewItems([]);
                setParseResult(null);
                setFileName('');
                setCurrentPage(1);
                setShowDiscardConfirm(false);
                toast.info('已放弃归档，预览数据已清除');
              }}
            >
              确认放弃
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-bold tracking-tight">提交审核</DialogTitle>
            <DialogDescription>
              将把 {previewItems.length} 条合同数据提交审核，管理员审核通过后正式入库生效。多个文件时请分别确认各自的项目/线别信息，留空则保持原值。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
            {filePreviews.map((fp) => {
              const form = confirmFileForms[fp.sourceFile] ?? EMPTY_CONFIRM_FILE_FORM;
              const updateForm = (patch: Partial<ConfirmFileForm>) => {
                setConfirmFileForms((prev) => ({
                  ...prev,
                  [fp.sourceFile]: { ...form, ...patch },
                }));
              };
              return (
                <div key={fp.sourceFile} className="space-y-3 rounded-2xl bg-secondary/50 p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <span className="truncate text-sm font-semibold">{fp.sourceFile}</span>
                    <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                      有效 {fp.validCount} / 共 {fp.count} 条
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">项目名称</label>
                      <Input
                        type="text"
                        placeholder="如 E38，留空保持原值"
                        value={form.project}
                        onChange={(e) => updateForm({ project: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">结算日期</label>
                      <Input
                        type="text"
                        placeholder="如 2026-09-08，留空取当天"
                        value={form.settleDate}
                        onChange={(e) => updateForm({ settleDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    {domain === 'welding' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">线别名称</label>
                        <Select
                          value={form.lineType}
                          onValueChange={(v) => updateForm({ lineType: v })}
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="保持原值" />
                          </SelectTrigger>
                          <SelectContent>
                            {LINE_TYPE_KEYWORDS.map(({ type }) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">项目时间</label>
                      <Input
                        type="text"
                        placeholder="如 2026-09-08，留空则不写入"
                        value={form.projectTime}
                        onChange={(e) => updateForm({ projectTime: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">工厂名称</label>
                      <Input
                        type="text"
                        placeholder="如 广州基地，留空则不写入"
                        value={form.factoryName}
                        onChange={(e) => updateForm({ factoryName: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setShowConfirm(false)}>
              取消
            </Button>
            <Button className="rounded-full" onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="size-4 animate-spin" />}
              确认提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invalid Data Dialog */}
      <Dialog open={showInvalidDialog} onOpenChange={setShowInvalidDialog}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 font-bold tracking-tight">
                <AlertCircle className="size-5 text-destructive" />
                异常数据汇总
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  共 {invalidCount} 条
                </span>
              </DialogTitle>

            </div>
            <DialogDescription className="text-left">
              以下数据因格式错误、价格异常或必填字段缺失无法归档，请修正后重新上传
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto px-6 py-4">
            {(() => {
              const totalInvalidPages = Math.ceil(invalidItems.length / INVALID_PAGE_SIZE) || 1;
              const start = (invalidPage - 1) * INVALID_PAGE_SIZE;
              const pagedInvalidItems = invalidItems.slice(start, start + INVALID_PAGE_SIZE);
              return (
                <>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium text-muted-foreground">序号</th>
                        <th className="py-2 text-left font-medium text-muted-foreground">设备/材料名称</th>
                        <th className="py-2 text-left font-medium text-muted-foreground">项目</th>
                        <th className="py-2 text-left font-medium text-muted-foreground">异常原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedInvalidItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-border last:border-0">
                          <td className="py-3 font-mono text-xs text-muted-foreground">{start + idx + 1}</td>
                          <td className="py-3">{item.device_material_name || '-'}</td>
                          <td className="py-3 font-mono text-xs">{item.project || '-'}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                              {item.invalidReason || '数据异常'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {totalInvalidPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={invalidPage <= 1}
                        onClick={() => setInvalidPage(invalidPage - 1)}
                      >
                        上一页
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {invalidPage} / {totalInvalidPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={invalidPage >= totalInvalidPages}
                        onClick={() => setInvalidPage(invalidPage + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="border-t border-border px-6 py-4">
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setShowInvalidDialog(false)}
            >
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractArchive;
