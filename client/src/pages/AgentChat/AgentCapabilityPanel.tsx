import React from 'react';
import { Wrench, Brain, ShieldAlert, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';

const TOOL_CAPABILITIES = [
  '测算', '史价快查', '模型演算', '未知清单',
  '溯源解释', '归档', '配置', '看板统计',
];

const THINK_CAPABILITIES = [
  '成本结构分析', '方案对比', '趋势解读', '报告生成', '制度问答(RAG)',
];

const AgentCapabilityPanel: React.FC = () => {
  return (
    <div className="hidden xl:flex w-72 shrink-0 flex-col border-l border-border bg-card/50 overflow-y-auto">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-bold tracking-tight text-sm mb-3 flex items-center gap-1.5">
            <Wrench className="size-4 text-primary" />
            工具调用
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {TOOL_CAPABILITIES.map(tool => (
              <span
                key={tool}
                className="rounded-full bg-primary/5 border border-primary/20 px-2.5 py-1 text-xs text-foreground/80"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-bold tracking-tight text-sm mb-3 flex items-center gap-1.5">
            <Brain className="size-4 text-violet-500" />
            通用思考
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {THINK_CAPABILITIES.map(cap => (
              <span
                key={cap}
                className="rounded-full bg-violet-50 border border-violet-200 px-2.5 py-1 text-xs text-foreground/80"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>

        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 p-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-amber-900">护栏</p>
              <ul className="space-y-1 text-xs text-amber-800 leading-relaxed">
                <li>算价只走确定性引擎</li>
                <li>报价必带溯源、查不到不编造</li>
                <li>写操作(改配置/归档/建模)需二次确认+审计</li>
                <li>敏感数据优先国内/私有模型</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-blue-200 bg-blue-50/50 p-3">
          <div className="flex items-start gap-2">
            <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-blue-900">形态</p>
              <p className="text-xs text-blue-800 leading-relaxed">
                全局悬浮球 / 侧边抽屉，任意界面可呼出。现有界面与功能不变，两条路（点界面 / 对话）走同一后端。
              </p>
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground/70 text-center">
          多模型可插拔：统一接口+配置切换+按场景路由
        </p>
      </div>
    </div>
  );
};

export default AgentCapabilityPanel;
