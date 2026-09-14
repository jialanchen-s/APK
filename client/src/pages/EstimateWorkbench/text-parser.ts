import { recognizeImage, parseDocument } from '@client/src/api/settings';
import type {
  EstimateTaskRow,
  LineType,
  UsageScope,
  SupplyType,
  ModifyLevel,
  CopyMode,
} from '@shared/api.interface';

/** 文本列名 → 字段名映射（含 AI 输出常见变体） */
const COLUMN_MAP: Record<string, keyof EstimateTaskRow> = {
  设备名称: 'device_name',
  线别: 'line_type',
  数量: 'quantity',
  单位: 'unit',
  专通用: 'usage_scope',
  供货方式: 'supply_type',
  改造等级: 'modify_level',
  复制: 'copy_mode',
  镜像: 'copy_mode',
  '复制/镜像': 'copy_mode',
  设备类型: 'device_type',
  '规格/备注': 'spec_remark',
  规格: 'spec_remark',
};

const VALID_LINE_TYPES: LineType[] = ['主线', '侧围线', '开闭件线', '下车体线'];
const VALID_USAGE_SCOPES: UsageScope[] = ['专用', '通用'];
const VALID_SUPPLY_TYPES: SupplyType[] = ['甲供', '乙供', '甲指乙供'];
const VALID_MODIFY_LEVELS: ModifyLevel[] = [
  '新增',
  '改造-微',
  '改造-小',
  '改造-中',
  '改造-大',
];
const VALID_COPY_MODES: CopyMode[] = ['原创', '复制', '镜像'];

function toValid<T extends string>(val: string, valid: T[], defaultVal?: T): T {
  const trimmed = String(val ?? '').trim();
  if (valid.includes(trimmed as T)) {
    return trimmed as T;
  }
  return (defaultVal ?? valid[0]) as T;
}

export type FileType = 'excel' | 'document' | 'image';

export function getFileType(file: File): FileType {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type.includes('spreadsheet')
  ) {
    return 'excel';
  }
  if (
    name.endsWith('.pdf') ||
    type === 'application/pdf' ||
    name.endsWith('.docx') ||
    name.endsWith('.doc') ||
    type.includes('word') ||
    type.includes('msword')
  ) {
    return 'document';
  }
  return 'image';
}

function splitPipeCells(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());
}

function buildRow(
  cells: string[],
  colIndex: Record<string, number>,
  defaultLineType?: LineType,
): EstimateTaskRow | null {
  const get = (field: keyof EstimateTaskRow): string =>
    colIndex[field] !== undefined
      ? String(cells[colIndex[field]] ?? '').trim()
      : '';

  const deviceName = get('device_name');
  if (!deviceName) return null;

  const quantity = parseFloat(get('quantity')) || 0;

  return {
    device_name: deviceName,
    line_type: toValid(get('line_type'), VALID_LINE_TYPES, defaultLineType),
    quantity,
    unit: get('unit') || '台',
    usage_scope: toValid(get('usage_scope'), VALID_USAGE_SCOPES),
    supply_type: toValid(get('supply_type'), VALID_SUPPLY_TYPES),
    modify_level: toValid(get('modify_level'), VALID_MODIFY_LEVELS),
    copy_mode: toValid(get('copy_mode'), VALID_COPY_MODES),
    device_type: get('device_type') || undefined,
    spec_remark: get('spec_remark') || undefined,
  };
}

function buildColIndex(
  cells: string[],
): Record<string, number> | null {
  const colIndex: Record<string, number> = {};
  cells.forEach((h, idx) => {
    const field = COLUMN_MAP[h.trim()];
    if (field && colIndex[field] === undefined) {
      colIndex[field] = idx;
    }
  });
  return Object.keys(colIndex).length > 0 ? colIndex : null;
}

/**
 * 将解析得到的文本（Markdown 表格 / TSV）转为 EstimateTaskRow[]
 * @param text - 解析的文本内容
 * @param defaultLineType - 默认线别，当文本中线别为空时使用此值
 */
export function parseTextRows(text: string, defaultLineType?: LineType): EstimateTaskRow[] {
  if (!text || !text.trim()) return [];

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l);

  // 1. Markdown 表格（含 | 分隔）
  const pipeLines = lines.filter((l) => l.includes('|'));
  if (pipeLines.length >= 2) {
    // 找到包含最多已知列名的行作为表头
    let headerIdx = -1;
    let bestColIndex: Record<string, number> | null = null;
    let maxMatches = 0;
    pipeLines.forEach((line, idx) => {
      const cells = splitPipeCells(line);
      const ci = buildColIndex(cells);
      if (ci && Object.keys(ci).length > maxMatches) {
        maxMatches = Object.keys(ci).length;
        headerIdx = idx;
        bestColIndex = ci;
      }
    });
    if (headerIdx === -1 || !bestColIndex) return [];

    const rows: EstimateTaskRow[] = [];
    for (let i = headerIdx + 1; i < pipeLines.length; i++) {
      const cells = splitPipeCells(pipeLines[i]);
      // 跳过分隔行 |---|---|
      if (cells.every((c) => /^[-:\s]*$/.test(c))) continue;
      const row = buildRow(cells, bestColIndex, defaultLineType);
      if (row) rows.push(row);
    }
    if (rows.length > 0) return rows;
  }

  // 2. Tab 分隔（TSV）
  const tabLines = lines.filter((l) => l.includes('\t'));
  if (tabLines.length >= 2) {
    const ci = buildColIndex(tabLines[0].split('\t').map((c) => c.trim()));
    if (!ci) return [];
    const rows: EstimateTaskRow[] = [];
    for (let i = 1; i < tabLines.length; i++) {
      const row = buildRow(tabLines[i].split('\t'), ci, defaultLineType);
      if (row) rows.push(row);
    }
    if (rows.length > 0) return rows;
  }

  return [];
}

/** 通过后端解析 PDF/Word → 文本 */
export async function parseDocumentToText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const fileBase64 = btoa(binary);
  const result = await parseDocument({ fileBase64, fileName: file.name });
  return result.content;
}

/** 通过后端 AI Gateway 识别图片内容 → 文本 */
export async function parseImageToText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const imageBase64 = btoa(binary);
  const mimeType = file.type || 'image/png';
  const result = await recognizeImage({ imageBase64, mimeType });
  return result.text;
}
