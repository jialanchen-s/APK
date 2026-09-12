import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Search, Download, TrendingUp, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { PriceQueryRecord, PriceQueryResponse } from '@shared/api.interface';

const PriceQuery: React.FC = () => {
  const [params, setParams] = useState({
    device_material_name: '',
    line_type: '全部',
    usage_scope: '不限',
    supply: '不限',
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PriceQueryResponse | null>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (params.device_material_name) queryParams.set('device_material_name', params.device_material_name);
      if (params.line_type !== '全部') queryParams.set('line_type', params.line_type);
      if (params.usage_scope !== '不限') queryParams.set('usage_scope', params.usage_scope);
      if (params.supply !== '不限') queryParams.set('supply', params.supply);

      const res = await axiosForBackend<PriceQueryResponse>({
        url: `/api/price-query/search?${queryParams.toString()}`,
        method: 'GET',
      });
      setResults(res.data);
      if (res.data.total === 0) {
        toast.info('未找到匹配的历史合同记录');
      }
    } catch (err) {
      toast.error('查询失败', { description: '请稍后重试' });
    } finally {
      setLoading(false);
    }
  }, [params]);

  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!results || results.items.length === 0) {
      toast.warning('没有可导出的数据');
      return;
    }
    setExporting(true);
    try {
      const queryParams = new URLSearchParams();
      if (params.device_material_name) queryParams.set('device_material_name', params.device_material_name);
      if (params.line_type !== '全部') queryParams.set('line_type', params.line_type);
      if (params.usage_scope !== '不限') queryParams.set('usage_scope', params.usage_scope);
      if (params.supply !== '不限') queryParams.set('supply', params.supply);
      queryParams.set('pageSize', '10000');

      const res = await axiosForBackend<PriceQueryResponse>({
        url: `/api/price-query/search?${queryParams.toString()}`,
        method: 'GET',
      });

      const rows = res.data.items.map((item: PriceQueryRecord) => ({
        '设备/材料名称': item.device_material_name,
        项目: item.project || '-',
        线别: item.line_type,
        供货: item.supply,
        '单价(元)': item.unit_price,
        价格口径: item.price_caliber,
        品牌: item.selected_brand || '-',
        工位号: item.workstation_no || '-',
        工位描述: item.workstation_desc || '-',
        归档日期: item.settle_date ? item.settle_date.slice(0, 7) : '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
        { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 18 }, { wch: 12 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '历史价格');

      const deviceName = params.device_material_name || '全部设备';
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `历史价格快查_${deviceName}_${dateStr}.xlsx`);

      toast.success(`已导出 ${res.data.items.length} 条记录`);
    } catch {
      toast.error('导出失败', { description: '请稍后重试' });
    } finally {
      setExporting(false);
    }
  }, [results, params]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="size-6 text-primary" />
          历史价格快查
          <Badge variant="secondary" className="text-xs font-medium">只读</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          不上传清单，选维度直接查某设备历史合同价与参考价。纯只读，不触发测算、不写库。
        </p>
      </div>

      {/* Query Card */}
      <Card className="rounded-3xl shadow-sm border border-gray-100">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">具体设备名称</label>
              <Input
                placeholder="如：涂胶机器人"
                value={params.device_material_name}
                onChange={(e) => setParams({ ...params, device_material_name: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">线别</label>
              <Select
                value={params.line_type}
                onValueChange={(v) => setParams({ ...params, line_type: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="全部">全部（跨线）</SelectItem>
                  <SelectItem value="主线">主线</SelectItem>
                  <SelectItem value="侧围线">侧围线</SelectItem>
                  <SelectItem value="开闭件线">开闭件线</SelectItem>
                  <SelectItem value="下车体线">下车体线</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">专通用</label>
              <Select
                value={params.usage_scope}
                onValueChange={(v) => setParams({ ...params, usage_scope: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="不限">不限</SelectItem>
                  <SelectItem value="专用">专用</SelectItem>
                  <SelectItem value="通用">通用</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">供货方式</label>
              <Select
                value={params.supply}
                onValueChange={(v) => setParams({ ...params, supply: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="不限">不限</SelectItem>
                  <SelectItem value="甲供">甲供</SelectItem>
                  <SelectItem value="乙供">乙供</SelectItem>
                  <SelectItem value="甲指乙供">甲指乙供</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                className="w-full rounded-full"
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? (
                  <span className="animate-spin mr-2">⏳</span>
                ) : (
                  <Search className="size-4 mr-2" />
                )}
                查询
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hit Records Table */}
          <Card className="lg:col-span-2 rounded-3xl shadow-sm border border-gray-100">
            <CardHeader>
              <CardTitle className="font-bold tracking-tight flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                命中记录
                <span className="text-sm font-normal text-muted-foreground">
                  （共 {results.total} 条）
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-xs font-bold whitespace-nowrap">项目</TableHead>
                      <TableHead className="text-xs font-bold whitespace-nowrap">设备/材料名称</TableHead>
                      <TableHead className="text-xs font-bold whitespace-nowrap">线别</TableHead>
                      <TableHead className="text-xs font-bold whitespace-nowrap">供货</TableHead>
                      <TableHead className="text-xs font-bold whitespace-nowrap text-right">单价(元)</TableHead>
                      <TableHead className="text-xs font-bold whitespace-nowrap">品牌</TableHead>
                      <TableHead className="text-xs font-bold whitespace-nowrap">工位号</TableHead>
                      <TableHead className="text-xs font-bold whitespace-nowrap">工位描述</TableHead>
                      <TableHead className="text-xs font-bold whitespace-nowrap">归档日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          暂无匹配数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      results.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.project || '-'}</TableCell>
                          <TableCell className="text-sm font-medium">{item.device_material_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs rounded-full">
                              {item.line_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{item.supply}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {item.unit_price.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-sm">{item.selected_brand || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{item.workstation_no || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.workstation_desc || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.settle_date ? item.settle_date.slice(0, 7) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Reference Price Card */}
          <Card className="rounded-3xl shadow-sm border border-gray-100">
            <CardHeader>
              <CardTitle className="font-bold tracking-tight flex items-center gap-2">
                <TrendingUp className="size-5 text-success" />
                参考价
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4">
                <div className="text-4xl font-light tracking-tight text-success">
                  {results.reference_price?.toFixed(1) ?? '-'}
                  <span className="text-lg ml-1">元</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {results.reference_note || '暂无参考数据'}
                </p>
              </div>

              {results.cross_line_note && (
                <div className="bg-accent/30 rounded-2xl p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {results.cross_line_note}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    口径：未税/元。
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <span className="animate-spin mr-2">⏳</span>
                ) : (
                  <Download className="size-4 mr-2" />
                )}
                {exporting ? '导出中...' : '导出结果'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PriceQuery;
