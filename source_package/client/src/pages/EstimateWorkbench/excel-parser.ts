import type {
  EstimateTaskRow,
  LineType,
  UsageScope,
  SupplyType,
  ModifyLevel,
  CopyMode,
} from '@shared/api.interface';

/** Excel 中文列名 → 字段名映射（支持新旧两种模板） */
const COLUMN_MAP: Record<string, keyof EstimateTaskRow> = {
  // 新模板列名
  '设备/材料名称': 'device_name',
  '设备名称': 'device_name',
  '线别': 'line_type',
  '数量': 'quantity',
  '单位': 'unit',
  '专通用': 'usage_scope',
  '类别': 'category',
  '区分': 'distinction',
  '供货': 'supply_type',
  '供货方式': 'supply_type',
  '改造等级': 'modify_level',
  '复制': 'copy_mode',
  '镜像': 'copy_mode',
  '复制/镜像': 'copy_mode',
  '设备类型': 'device_type',
  '工位号': 'workstation_no',
  '工位描述': 'workstation_desc',
  '品牌': 'brand',
  '规格/备注': 'spec_remark',
  '规格': 'spec_remark',
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

/** 检测表头行索引（跳过合并标题行） */
function detectHeaderRowIndex(sheetData: (string | number)[][]): number {
  if (!sheetData || sheetData.length === 0) return 0;
  const firstRow = sheetData[0].map((h) => String(h ?? '').trim());
  const hasDeviceCol = firstRow.some((h) =>
    h === '设备/材料名称' || h === '设备名称' ||
    h === '序号' || h === '工位号',
  );
  if (hasDeviceCol && firstRow.some((h) => h === '设备/材料名称' || h === '设备名称')) {
    return 0;
  }
  if (sheetData.length >= 2) {
    const secondRow = sheetData[1].map((h) => String(h ?? '').trim());
    if (secondRow.some((h) => h === '设备/材料名称' || h === '设备名称' || h === '序号')) {
      return 1;
    }
  }
  return 0;
}

/**
 * 将 xlsx 解析出的二维数组（header + rows）转为 EstimateTaskRow[]
 * @param sheetData - Excel解析出的二维数组
 * @param defaultLineType - 默认线别，当Excel中线别为空时使用此值
 */
export function parseExcelRows(
  sheetData: (string | number)[][],
  defaultLineType?: LineType,
): EstimateTaskRow[] {
  if (!sheetData || sheetData.length < 2) return [];

  const headerIdx = detectHeaderRowIndex(sheetData);
  const header = sheetData[headerIdx].map((h) => String(h ?? '').trim());
  const colIndex: Record<string, number> = {};
  header.forEach((h, idx) => {
    const field = COLUMN_MAP[h];
    if (field && colIndex[field] === undefined) {
      colIndex[field] = idx;
    }
  });

  const rows: EstimateTaskRow[] = [];
  for (let i = headerIdx + 1; i < sheetData.length; i++) {
    const raw = sheetData[i];
    if (!raw || raw.every((c) => c === null || c === undefined || c === '')) {
      continue;
    }

    const get = (field: keyof EstimateTaskRow): string =>
      colIndex[field] !== undefined
        ? String(raw[colIndex[field]] ?? '').trim()
        : '';

    const deviceName = get('device_name');
    if (!deviceName) continue;

    const quantityStr = get('quantity');
    const quantity = parseFloat(quantityStr) || 0;

    const distinctionVal = get('distinction');
    const modifyLevelRaw = get('modify_level') || distinctionVal;

    rows.push({
      device_name: deviceName,
      line_type: toValid(get('line_type'), VALID_LINE_TYPES, defaultLineType),
      quantity,
      unit: get('unit') || '台',
      usage_scope: toValid(get('usage_scope'), VALID_USAGE_SCOPES),
      supply_type: toValid(get('supply_type'), VALID_SUPPLY_TYPES),
      modify_level: toValid(modifyLevelRaw, VALID_MODIFY_LEVELS),
      copy_mode: toValid(get('copy_mode'), VALID_COPY_MODES),
      device_type: get('device_type') || undefined,
      workstation_no: get('workstation_no') || undefined,
      workstation_desc: get('workstation_desc') || undefined,
      brand: get('brand') || undefined,
      category: get('category') || undefined,
      distinction: distinctionVal || undefined,
      spec_remark: get('spec_remark') || undefined,
    });
  }

  return rows;
}

export { COLUMN_MAP };
