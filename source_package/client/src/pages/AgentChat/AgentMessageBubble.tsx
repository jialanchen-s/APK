import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User, FileSpreadsheet, Wrench, Brain, ChevronDown, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AgentMessage, AgentMessageMetadata, AgentStep } from '@shared/api.interface';
import { DeviceMatchCard, ParamExtractCard, AnomalyCheckCard } from './AgentActionCards';

interface AgentMessageBubbleProps {
  message: AgentMessage;
  onConfirm: (messageId: string) => void;
  onReject: (messageId: string) => void;
  actionLoading: string | null;
}

function extractToolCalls(content: string): { tools: string[]; text: string } {
  const toolRegex = /🔧\s*调用\s+(\S+)\(([^)]*)\)/g;
  const tools: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = toolRegex.exec(content)) !== null) {
    tools.push(`${match[1]}(${match[2]})`);
  }
  const text = content.replace(toolRegex, '').trim();
  return { tools, text };
}

function extractSourceNote(content: string): string | null {
  const sourceRegex = /（数据来自历史库，非我估算）/;
  const match = content.match(sourceRegex);
  if (match) return match[1];
  return null;
}

function renderContentWithBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

const AgentMessageBubble: React.FC<AgentMessageBubbleProps> = ({
  message,
  onConfirm,
  onReject,
  actionLoading,
}) => {
  const isUser = message.role === 'user';
  const metadata = message.metadata as AgentMessageMetadata | undefined;
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const navigate = useNavigate();

  const actionCardProps = {
    messageId: message.id,
    status: message.status ?? 'sent',
    onConfirm,
    onReject,
    actionLoading,
  };

  const rawContent = message.content ?? '';
  const { tools, text } = isUser ? { tools: [], text: rawContent } : extractToolCalls(rawContent);
  const sourceNote = !isUser ? extractSourceNote(text) : null;
  const displayText = sourceNote ? text.replace(`（${sourceNote}）`, '').trim() : text;

  return (
    <div className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full',
        isUser ? 'bg-blue-100' : 'bg-violet-100',
      )}>
        {isUser ? (
          <User className="size-4 text-blue-600" />
        ) : (
          <Bot className="size-4 text-violet-600" />
        )}
      </div>

      <div className={cn('max-w-[80%] space-y-1.5', isUser && 'flex flex-col items-end')}>
        {message.message_type === 'file_upload' ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/30 px-3 py-2">
            <FileSpreadsheet className="size-4 text-emerald-600" />
            <span className="text-sm">{message.content}</span>
          </div>
        ) : displayText ? (
          <div className={cn(
            'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-white border border-border rounded-tl-sm',
          )}>
            {renderContentWithBold(displayText)}
            {sourceNote && (
              <span className="block mt-1.5 text-xs text-muted-foreground/80">
                （{sourceNote}）
              </span>
            )}
          </div>
        ) : null}

        {tools.length > 0 && (
          <div className="space-y-1">
            {tools.map((tool, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground font-mono"
              >
                <Wrench className="size-3 shrink-0 text-primary/60" />
                <span>调用 {tool}</span>
              </div>
            ))}
          </div>
        )}

        {message.message_type === 'agent_steps' && metadata?.agent_steps && (
          <AgentStepsSection
            steps={metadata.agent_steps}
            expanded={stepsExpanded}
            onToggle={() => setStepsExpanded(!stepsExpanded)}
          />
        )}

        {message.message_type === 'device_match' && metadata?.devices && (
          <DeviceMatchCard devices={metadata.devices} {...actionCardProps} />
        )}
        {message.message_type === 'param_extract' && metadata?.params && (
          <ParamExtractCard params={metadata.params} {...actionCardProps} />
        )}
        {message.message_type === 'anomaly_check' && metadata?.anomalies && (
          <AnomalyCheckCard
            anomalies={metadata.anomalies}
            riskLevel={metadata.risk_level ?? 'low'}
            recommendation={metadata.recommendation}
            overallAssessment={metadata.overall_assessment}
            {...actionCardProps}
          />
        )}
        {message.message_type === 'summary' && metadata?.task_id && (
          <button
            onClick={() => {
              if (metadata?.task_id) {
                sessionStorage.setItem('estimate_task_id', metadata.task_id);
              }
              navigate('/');
            }}
            className="flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs text-foreground hover:bg-accent hover:border-primary/30 transition-colors"
          >
            <ExternalLink className="size-3 text-primary" />
            <span>查看完整测算结果</span>
          </button>
        )}
      </div>
    </div>
  );
};

const AgentStepsSection: React.FC<{
  steps: AgentStep[];
  expanded: boolean;
  onToggle: () => void;
}> = ({ steps, expanded, onToggle }) => {
  const toolCalls = steps.filter((s) => s.type === 'tool_call');
  const toolCount = toolCalls.length;

  return (
    <div className="w-full">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
        <Brain className="size-3" />
        <span>思考过程 · {toolCount} 次工具调用</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 rounded-xl border border-border bg-muted/20 p-2.5">
          {steps.map((step, i) => (
            <AgentStepItem key={i} step={step} />
          ))}
        </div>
      )}
    </div>
  );
};

const AgentStepItem: React.FC<{ step: AgentStep }> = ({ step }) => {
  if (step.type === 'thinking') {
    if (!step.content) return null;
    return (
      <div className="flex gap-1.5">
        <Brain className="size-3 shrink-0 mt-0.5 text-violet-400" />
        <span className="text-xs text-muted-foreground leading-relaxed">{step.content}</span>
      </div>
    );
  }

  if (step.type === 'tool_call') {
    return (
      <div className="flex gap-1.5">
        <Wrench className="size-3 shrink-0 mt-0.5 text-primary/60" />
        <div className="text-xs">
          <span className="font-mono font-medium text-foreground">{step.tool_name}</span>
          {step.tool_parameters && Object.keys(step.tool_parameters).length > 0 && (
            <span className="ml-1 text-muted-foreground font-mono">
              ({JSON.stringify(step.tool_parameters)})
            </span>
          )}
        </div>
      </div>
    );
  }

  if (step.type === 'tool_result') {
    const resultStr = step.tool_result ? JSON.stringify(step.tool_result, null, 0) : '';
    const isError = resultStr.includes('"error"') || resultStr.startsWith('{"error');
    const truncated = resultStr.length > 300 ? resultStr.substring(0, 300) + '...' : resultStr;
    return (
      <div className="flex gap-1.5 ml-4">
        {isError ? (
          <AlertCircle className="size-3 shrink-0 mt-0.5 text-red-400" />
        ) : (
          <CheckCircle2 className="size-3 shrink-0 mt-0.5 text-emerald-400" />
        )}
        <span className={cn('text-xs font-mono leading-relaxed', isError ? 'text-red-500' : 'text-muted-foreground')}>
          {truncated}
        </span>
      </div>
    );
  }

  return null;
};

export default AgentMessageBubble;
