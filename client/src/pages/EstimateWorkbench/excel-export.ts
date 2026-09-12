import * as XLSX from 'xlsx';
import type { EstimateTaskItem } from '@shared/api.interface';

const TEMPLATE_HEADERS = [
  '序号', '工位号', '工位描述', '设备/材料名称', '类别', '区分',
  '供货', '复制/镜像', '规格/备注', '数量', '单位', '单价（未税）/元', '总价（未税）/元', '备注',
];

interface ExportRow {
  [key: string]: string | number;
}

/** 将结果项转为 Excel 行数据（与预算清单模板格式一致） */
function itemToRow(item: EstimateTaskItem, index: number): ExportRow {
  const price = item.status === 'jia_gong' ? 0 : item.price;
  const totalPrice = item.status === 'jia_gong' ? 0 : item.total_price;

  const traceParts: string[] = [];
  if (item.brand) traceParts.push(`品牌:${item.brand}`);
  if (item.source) traceParts.push(`数据源头:${item.source}`);
  if (item.match_level) traceParts.push(`取值逻辑:${item.match_level}`);
  if (item.remark) traceParts.push(item.remark);
  const remarkStr = traceParts.join(' | ');

  return {
    '序号': index + 1,
    '工位号': item.workstation_no || '',
    '工位描述': item.workstation_desc || '',
    '设备/材料名称': item.device_name,
    '类别': item.category || item.usage_scope || '',
    '区分': item.distinction || '',
    '供货': item.supply_type,
    '复制/镜像': item.copy_mode || '',
    '规格/备注': item.spec_remark || '',
    '数量': item.quantity,
    '单位': item.unit,
    '单价（未税）/元': price,
    '总价（未税）/元': totalPrice,
    '备注': remarkStr,
  };
}

/** 生成并下载 Excel 文件（与预算清单模板格式一致） */
export function downloadItemsAsExcel(
  items: EstimateTaskItem[],
  fileName: string,
): void {
  const rows = items.map((item, index) => itemToRow(item, index));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_HEADERS });

  worksheet['!cols'] = [
    { wch: 6 },  // 序号
    { wch: 12 }, // 工位号
    { wch: 20 }, // 工位描述
    { wch: 24 }, // 设备/材料名称
    { wch: 10 }, // 类别
    { wch: 10 }, // 区分
    { wch: 10 }, // 供货
    { wch: 10 }, // 复制/镜像
    { wch: 20 }, // 规格/备注
    { wch: 8 },  // 数量
    { wch: 8 },  // 单位
    { wch: 14 }, // 单价（未税）/元
    { wch: 14 }, // 总价（未税）/元
    { wch: 40 }, // 备注
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '测算结果');
  XLSX.writeFile(workbook, fileName);
}

/** 按结果类型筛选并下载 */
export function downloadResultExcel(
  items: EstimateTaskItem[],
  type: 'main' | 'unknown',
): void {
  if (type === 'main') {
    const mainItems = items.filter(
      (it) => it.status === 'success' || it.status === 'jia_gong',
    );
    downloadItemsAsExcel(mainItems, '测算主成果.xlsx');
  } else {
    const unknownItems = items.filter((it) => it.status === 'pending');
    downloadItemsAsExcel(unknownItems, '未知清单.xlsx');
  }
}
