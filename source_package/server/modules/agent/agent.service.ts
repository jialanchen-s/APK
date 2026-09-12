import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
  CapabilityService,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, count, inArray, sql, avg, min, max, like, gte } from 'drizzle-orm';
import {
  agentSession,
  agentMessage,
  pendingItem,
  model as modelTable,
  contract,
} from '@server/database/schema';
import { EstimateTaskService } from '@server/modules/estimate-task/estimate-task.service';
import { ModelService } from '@server/modules/model/model.service';
import {
  buildToolDefinitionsPrompt,
  executeAgentTool,
  type ToolContext,
} from './agent-tools';
import type {
  CreateAgentSessionRequest,
  CreateAgentSessionResponse,
  AgentSessionListResponse,
  AgentSessionDetailResponse,
  AgentSession,
  AgentMessage,
  AgentMessageMetadata,
  AgentSessionContext,
  DeviceMatchItem,
  ParamExtractItem,
  AnomalyItem,
  SendAgentMessageRequest,
  SendAgentMessageResponse,
  AgentActionResponse,
  AgentContextResponse,
  AgentChatRequest,
  AgentChatResponse,
  AgentStep,
  EstimateTaskRow,
  AgentTaskStatusResponse,
} from '@shared/api.interface';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    @Inject() private readonly capabilityService: CapabilityService,
    private readonly estimateTaskService: EstimateTaskService,
    private readonly modelService: ModelService,
  ) {}

  async createSession(
    userId: string,
    data: CreateAgentSessionRequest,
  ): Promise<CreateAgentSessionResponse> {
    const [row] = await this.db
      .insert(agentSession)
      .values({
        title: data.title || '新建测算会话',
        status: 'active',
      })
      .returning({ id: agentSession.id, title: agentSession.title, createdAt: agentSession.createdAt });

    return {
      id: row.id,
      title: row.title ?? '新建测算会话',
      status: 'active',
      created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  async listSessions(page: number, pageSize: number): Promise<AgentSessionListResponse> {
    const offset = Math.max(0, (page - 1) * pageSize);
    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          id: agentSession.id,
          title: agentSession.title,
          status: agentSession.status,
          taskId: agentSession.taskId,
          context: agentSession.context,
          createdAt: agentSession.createdAt,
        })
        .from(agentSession)
        .orderBy(desc(agentSession.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ cnt: count() }).from(agentSession),
    ]);

    const items: AgentSession[] = rows.map((r) => ({
      id: r.id,
      title: r.title ?? '',
      status: (r.status ?? 'active') as AgentSession['status'],
      task_id: r.taskId ?? undefined,
      context: (r.context as AgentSessionContext) ?? undefined,
      created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));

    return { items, total: Number(countRows[0]?.cnt ?? 0) };
  }

  async getSession(id: string): Promise<AgentSessionDetailResponse> {
    const sessionRows = await this.db
      .select()
      .from(agentSession)
      .where(eq(agentSession.id, id))
      .limit(1);
    if (sessionRows.length === 0) throw new NotFoundException('会话不存在');

    const s = sessionRows[0];
    const session: AgentSession = {
      id: s.id,
      title: s.title ?? '',
      status: (s.status ?? 'active') as AgentSession['status'],
      task_id: s.taskId ?? undefined,
      context: (s.context as AgentSessionContext) ?? undefined,
      created_at: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    };

    const msgRows = await this.db
      .select()
      .from(agentMessage)
      .where(eq(agentMessage.sessionId, id))
      .orderBy(agentMessage.createdAt);
    const messages: AgentMessage[] = msgRows.map((m) => ({
      id: m.id,
      session_id: m.sessionId,
      role: m.role as AgentMessage['role'],
      content: m.content ?? undefined,
      message_type: (m.messageType ?? 'text') as AgentMessage['message_type'],
      metadata: (m.metadata as AgentMessageMetadata) ?? undefined,
      status: (m.status ?? 'sent') as AgentMessage['status'],
      created_at: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
    }));

    return { session, messages };
  }

  async deleteSession(userId: string, id: string): Promise<{ success: boolean }> {
    // 先删除关联的消息
    await this.db
      .delete(agentMessage)
      .where(eq(agentMessage.sessionId, id));

    // 再删除会话
    await this.db
      .delete(agentSession)
      .where(eq(agentSession.id, id));

    return { success: true };
  }

  async sendMessage(
    userId: string,
    sessionId: string,
    data: SendAgentMessageRequest,
  ): Promise<SendAgentMessageResponse> {
    const role = data.role ?? 'user';
    const messageType = data.message_type ?? 'text';

    const message = await this.saveMessage(
      sessionId,
      role,
      data.content,
      messageType,
      data.metadata,
    );

    if (role === 'agent') {
      return { message };
    }

    if (messageType === 'file_upload' && data.rows && data.rows.length > 0) {
      const agentMsg = await this.processFileUpload(userId, sessionId, message, data.rows, data.metadata?.file_name);
      return { message, agentMessage: agentMsg };
    }

    // 检测价格查询意图
    if (data.content && this.isPriceQueryIntent(data.content)) {
      const agentMsg = await this.processPriceQuery(sessionId, data.content);
      return { message, agentMessage: agentMsg };
    }

    return { message };
  }

  async confirmAction(
    userId: string,
    sessionId: string,
    messageId: string,
  ): Promise<AgentActionResponse> {
    const msgRows = await this.db
      .select()
      .from(agentMessage)
      .where(and(eq(agentMessage.id, messageId), eq(agentMessage.sessionId, sessionId)))
      .limit(1);
    if (msgRows.length === 0) throw new NotFoundException('消息不存在');

    const msg = msgRows[0] as Record<string, unknown>;
    const metadata = (msg.metadata as AgentMessageMetadata) ?? {};
    const msgType = (msg.messageType as string) ?? 'text';

    await this.db
      .update(agentMessage)
      .set({ status: 'confirmed' })
      .where(eq(agentMessage.id, messageId));

    let agentMsg: AgentMessage | undefined;

    if (msgType === 'device_match' && metadata.devices) {
      agentMsg = await this.performParamExtraction(metadata.devices, sessionId);
    } else if (msgType === 'param_extract' && metadata.params) {
      agentMsg = await this.performCalculationAndAnomalyCheck(metadata.params, sessionId);
    } else if (msgType === 'anomaly_check') {
      await this.db
        .update(agentSession)
        .set({ status: 'completed' })
        .where(eq(agentSession.id, sessionId));
      await this.updateSessionContext(sessionId, { current_step: 'complete' });
      agentMsg = await this.saveMessage(
        sessionId,
        'agent',
        '异常审核完成。本次测算已全部完成，结果文件可从测算工作台下载。',
        'summary',
      );
    }

    return { success: true, agentMessage: agentMsg };
  }

  async rejectAction(
    userId: string,
    sessionId: string,
    messageId: string,
  ): Promise<AgentActionResponse> {
    const msgRows = await this.db
      .select()
      .from(agentMessage)
      .where(and(eq(agentMessage.id, messageId), eq(agentMessage.sessionId, sessionId)))
      .limit(1);
    if (msgRows.length === 0) throw new NotFoundException('消息不存在');

    await this.db
      .update(agentMessage)
      .set({ status: 'rejected' })
      .where(eq(agentMessage.id, messageId));

    const msg = msgRows[0];
    const msgType = (msg as { messageType: string }).messageType ?? 'text';
    const rejectText: Record<string, string> = {
      device_match: '设备匹配建议已跳过。你可以手动在批量参数填报页选择模型，或在下方描述设备信息让我重新匹配。',
      param_extract: '参数提取建议已跳过。你可以手动在批量参数填报页填写参数。',
      anomaly_check: '异常检测结果已标记。请在测算工作台查看完整结果。',
    };

    const agentMsg = await this.saveMessage(
      sessionId,
      'agent',
      rejectText[msgType] || '操作已取消。',
      'text',
    );

    return { success: true, agentMessage: agentMsg };
  }

  async chatWithAgent(
    userId: string,
    sessionId: string,
    data: AgentChatRequest,
  ): Promise<AgentChatResponse> {
    this.logger.log(`chatWithAgent: sessionId=${sessionId}, content=${data.content.substring(0, 100)}`);

    const userMessage = await this.saveMessage(sessionId, 'user', data.content, 'text');

    const systemPrompt = this.buildAgentSystemPrompt();
    const history = await this.getRecentHistory(sessionId, 20);
    const { sessionContext, pendingItems } = await this.getSessionContextData(sessionId);

    const steps: AgentStep[] = [];
    const observations: string[] = [];
    const maxIterations = 10;
    let finalAnswer = '';

    const toolCtx: ToolContext = {
      db: this.db,
      capabilityService: this.capabilityService,
      estimateTaskService: this.estimateTaskService,
      modelService: this.modelService,
      userId,
      sessionId,
    };

    for (let i = 0; i < maxIterations; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const context = this.buildAgentContext(history, observations, data.content, sessionContext, pendingItems);

      let llmContent = '';
      try {
        const output = await this.capabilityService
          .load('welding_cost_calculation_chat_assistant_1')
          .call('textGenerate', {
            user_question: data.content,
            system_context: systemPrompt + '\n\n' + context,
          }) as { content: string };
        llmContent = output.content || '';
      } catch (err) {
        this.logger.error('LLM调用失败', JSON.stringify(err));
        if (i === 0) {
          finalAnswer = '抱歉，AI服务暂时不可用，请稍后重试。';
          steps.push({ type: 'answer', content: finalAnswer });
          break;
        }
        // 如果已有工具调用结果，基于观察结果生成简单回复
        finalAnswer = this.buildFallbackAnswer(observations, data.content);
        steps.push({ type: 'answer', content: finalAnswer });
        break;
      }

      const parsed = this.parseAgentResponse(llmContent);

      if (parsed.action === 'final_answer') {
        finalAnswer = parsed.answer || llmContent;
        steps.push({ type: 'thinking', content: parsed.thought || '' });
        steps.push({ type: 'answer', content: finalAnswer });
        break;
      }

      if (!parsed.action || !parsed.parameters) {
        finalAnswer = llmContent || '我无法理解如何处理这个请求。';
        steps.push({ type: 'answer', content: finalAnswer });
        break;
      }

      steps.push({ type: 'thinking', content: parsed.thought || '' });
      steps.push({
        type: 'tool_call',
        content: '',
        tool_name: parsed.action,
        tool_parameters: parsed.parameters,
      });

      const result = await executeAgentTool(parsed.action, parsed.parameters, toolCtx);

      const resultSummary = result.success
        ? JSON.stringify(result.data).substring(0, 2000)
        : `错误: ${result.error}`;
      observations.push(`[工具 ${parsed.action} 结果] ${resultSummary}`);

      steps.push({
        type: 'tool_result',
        content: '',
        tool_name: parsed.action,
        tool_result: result.success ? result.data : { error: result.error },
      });

      if (!result.success) {
        this.logger.warn(`工具执行失败: ${parsed.action} - ${result.error}`);
      }
    }

    if (!finalAnswer) {
      finalAnswer = '已达到最大工具调用次数。根据已获取的信息，以上是处理结果。';
      steps.push({ type: 'answer', content: finalAnswer });
    }

    const agentMessage = await this.saveMessage(
      sessionId,
      'agent',
      finalAnswer,
      'agent_steps',
      { agent_steps: steps },
    );

    await this.updateSessionContext(sessionId, { last_query: data.content });

    return { message: userMessage, agentMessage };
  }

  private buildAgentSystemPrompt(): string {
    return [
      '你是一个焊装费用核算Agent。你可以自主决策使用工具完成用户的任务，同时具备通用知识能力。',
      '',
      '## 角色定位',
      '- 你是焊装成本核算领域的专业助手，同时也是一个有通用知识的AI',
      '- 用户可以问你任何问题，不只是测算相关的。对于通用问题（行业常识、设备基础知识、工艺流程等），直接用你的知识回答',
      '- 对于价格类问题：优先用工具查系统数据，系统没有数据时可以用你的行业知识给出参考范围，但必须标注是「行业参考」',
      '',
      '## 对话记忆与上下文',
      '- 你拥有完整的对话记忆，包括本次会话的对话历史、已上传文件信息、测算任务状态和待处理参数',
      '- 如果上下文中已有关联的测算任务（task_id），直接使用该 task_id 查询状态或结果，不要要求用户重新上传文件',
      '- 如果上下文中有待处理参数（pending_params），主动告知用户哪些设备需要补充参数，并说明缺失的参数名称',
      '- 用户后续问题可能基于之前的对话，请结合历史上下文理解用户意图',
      '- 如果用户问题涉及之前查询过的设备或价格，优先引用已有结果，避免重复查询',
      '',
      buildToolDefinitionsPrompt(),
      '',
      '## 输出格式',
      '',
      '每次回复，你必须输出严格的JSON（不要有其他文字，不要用```包裹）：',
      '',
      '需要调用工具时：',
      '{"thought":"简短说明为什么调用这个工具","action":"工具名称","parameters":{...}}',
      '',
      '任务完成或不需要工具时：',
      '{"thought":"任务完成的判断","action":"final_answer","answer":"给用户的最终回复"}',
      '',
      '## 规则',
      '- 每次只调用一个工具',
      '- 根据工具返回结果决定下一步',
      '- 最多调用10次工具',
      '- 正式测算任务的价格数据必须来自工具调用结果（合同匹配/模型公式），确保可溯源',
      '- 当用户询问某设备价格时，先调用 search_contracts 查系统数据；如果系统无数据，可以用你的行业知识给出参考价格范围，但必须明确标注「以下为行业参考，非系统数据」',
      '- 对于非价格类通用问题（工艺、设备原理、行业惯例等），直接用你的知识回答，不需要调用工具',
      '- 如果工具返回错误，告知用户并建议解决方案',
      '- 回复使用中文',
      '- 如果用户提到「之前的」「上次说的」「刚才那个」等指代词，优先从对话历史和项目上下文中查找对应信息',
    ].join('\n');
  }

  private async getRecentHistory(
    sessionId: string,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.db
      .select({
        role: agentMessage.role,
        content: agentMessage.content,
        messageType: agentMessage.messageType,
        metadata: agentMessage.metadata,
      })
      .from(agentMessage)
      .where(eq(agentMessage.sessionId, sessionId))
      .orderBy(desc(agentMessage.createdAt))
      .limit(limit);

    return rows.reverse().map((r) => {
      const label = r.role === 'user' ? '用户' : '助手';
      const msgType = r.messageType ?? 'text';
      const content = (r.content ?? '').substring(0, 800);
      const meta = r.metadata as AgentMessageMetadata | null;

      const typeTag = msgType !== 'text' ? `[${msgType}] ` : '';
      let metaSummary = '';
      if (meta) {
        if (meta.file_name) metaSummary += `（文件: ${meta.file_name}）`;
        if (meta.task_id) metaSummary += `（任务: ${meta.task_id.slice(0, 8)}）`;
        if (meta.stats) metaSummary += `（共${meta.stats.total}条, 匹配${meta.stats.matched}条, 待处理${meta.stats.pending}条）`;
        if (meta.devices && meta.devices.length > 0) metaSummary += `（设备匹配${meta.devices.length}条）`;
        if (meta.params && meta.params.length > 0) metaSummary += `（参数提取${meta.params.length}条）`;
        if (meta.anomalies && meta.anomalies.length > 0) metaSummary += `（异常${meta.anomalies.length}条）`;
      }

      return `[${label}] ${typeTag}${content}${metaSummary}`;
    });
  }

  private async getSessionContextData(
    sessionId: string,
  ): Promise<{ sessionContext: AgentSessionContext | null; pendingItems: Array<{ deviceName: string; modelName: string | null; status: string }> }> {
    const sessionRows = await this.db
      .select({ context: agentSession.context, taskId: agentSession.taskId })
      .from(agentSession)
      .where(eq(agentSession.id, sessionId))
      .limit(1);

    if (sessionRows.length === 0) {
      return { sessionContext: null, pendingItems: [] };
    }

    const sessionContext = (sessionRows[0].context as AgentSessionContext) ?? null;
    const taskId = sessionRows[0].taskId ?? sessionContext?.task_id;

    let pendingItems: Array<{ deviceName: string; modelName: string | null; status: string }> = [];
    if (taskId) {
      const pendingRows = await this.db
        .select({
          deviceName: pendingItem.deviceName,
          modelId: pendingItem.modelId,
          status: pendingItem.status,
        })
        .from(pendingItem)
        .where(eq(pendingItem.taskId, taskId))
        .limit(50);
      pendingItems = pendingRows.map((r) => ({
        deviceName: r.deviceName,
        modelName: r.modelId,
        status: r.status ?? 'pending',
      }));
    }

    return { sessionContext, pendingItems };
  }

  private buildAgentContext(
    history: string[],
    observations: string[],
    currentUserMessage: string,
    sessionContext: AgentSessionContext | null,
    pendingItems: Array<{ deviceName: string; modelName: string | null; status: string }>,
  ): string {
    const parts: string[] = [];

    if (sessionContext) {
      parts.push('## 项目上下文');
      const ctxLines: string[] = [];
      if (sessionContext.file_name) ctxLines.push(`已上传文件: ${sessionContext.file_name}`);
      if (sessionContext.line_type) ctxLines.push(`产线类型: ${sessionContext.line_type}`);
      if (sessionContext.task_id) ctxLines.push(`关联测算任务: ${sessionContext.task_id}`);
      if (sessionContext.total_rows !== undefined) ctxLines.push(`设备总数: ${sessionContext.total_rows}`);
      if (sessionContext.matched_rows !== undefined) ctxLines.push(`已匹配: ${sessionContext.matched_rows}`);
      if (sessionContext.pending_rows !== undefined) ctxLines.push(`待处理: ${sessionContext.pending_rows}`);
      if (sessionContext.current_step) ctxLines.push(`当前步骤: ${sessionContext.current_step}`);
      if (sessionContext.last_query) ctxLines.push(`上次查询: ${sessionContext.last_query}`);
      if (ctxLines.length > 0) {
        parts.push(ctxLines.join('\n'));
        parts.push('');
      }
    }

    if (pendingItems.length > 0) {
      parts.push('## 待处理参数');
      const pending = pendingItems.filter((p) => p.status === 'pending' || p.status === 'filled');
      if (pending.length > 0) {
        parts.push(`共 ${pending.length} 条待处理设备：`);
        for (const p of pending.slice(0, 15)) {
          const modelInfo = p.modelName ? `（模型: ${p.modelName}）` : '（未匹配模型）';
          parts.push(`- ${p.deviceName} ${modelInfo} [${p.status}]`);
        }
        if (pending.length > 15) {
          parts.push(`...及其他 ${pending.length - 15} 条`);
        }
      }
      parts.push('');
    }

    if (history.length > 0) {
      parts.push('## 对话历史');
      parts.push(history.join('\n'));
    }

    if (observations.length > 0) {
      parts.push('');
      parts.push('## 工具调用观察结果');
      parts.push(observations.join('\n'));
    }

    parts.push('');
    parts.push(`## 当前用户消息\n${currentUserMessage}`);

    return parts.join('\n');
  }

  private parseAgentResponse(content: string): {
    thought: string;
    action: string;
    parameters?: Record<string, unknown>;
    answer?: string;
  } {
    const jsonStr = this.extractJson(content);
    if (!jsonStr) {
      return {
        thought: 'LLM未返回有效JSON，直接使用回复内容',
        action: 'final_answer',
        answer: content,
      };
    }

    try {
      const obj = JSON.parse(jsonStr) as {
        thought?: string;
        action?: string;
        parameters?: Record<string, unknown>;
        answer?: string;
      };

      return {
        thought: obj.thought ?? '',
        action: obj.action ?? 'final_answer',
        parameters: obj.parameters,
        answer: obj.answer,
      };
    } catch {
      return {
        thought: 'JSON解析失败',
        action: 'final_answer',
        answer: content,
      };
    }
  }

  private buildFallbackAnswer(observations: string[], userQuestion: string): string {
    const searchResults: Array<Record<string, unknown>> = [];
    let taskResult: Record<string, unknown> | null = null;

    for (const obs of observations) {
      if (obs.includes('[工具 search_contracts 结果]')) {
        try {
          const jsonStr = obs.replace('[工具 search_contracts 结果]', '').trim();
          const data = JSON.parse(jsonStr) as { items?: Array<Record<string, unknown>> };
          if (data.items && data.items.length > 0) {
            searchResults.push(...data.items.slice(0, 5));
          }
        } catch {
          // ignore
        }
      }
      if (obs.includes('[工具 create_estimate_task 结果]') || obs.includes('[工具 get_task_status 结果]')) {
        try {
          const jsonStr = obs.replace(/\[工具 \w+ 结果\]/, '').trim();
          const data = JSON.parse(jsonStr) as Record<string, unknown>;
          taskResult = data;
        } catch {
          // ignore
        }
      }
    }

    if (searchResults.length > 0) {
      const deviceName = String(searchResults[0].device_name ?? userQuestion.replace(/价格|查询/g, ''));
      const items = searchResults.slice(0, 5);
      const avgPrice = items.reduce((sum, it) => sum + (parseFloat(String(it.price ?? 0)) || 0), 0) / items.length;
      const minPrice = Math.min(...items.map((it) => parseFloat(String(it.price ?? 0)) || 0));
      const maxPrice = Math.max(...items.map((it) => parseFloat(String(it.price ?? 0)) || 0));

      return `根据历史合同数据，**${deviceName}** 的参考价格：\n\n` +
        `- 近${items.length}条记录均价：**${avgPrice.toFixed(1)} 元（未税）**\n` +
        `- 价格区间：${minPrice.toFixed(1)} - ${maxPrice.toFixed(1)} 元\n\n` +
        `> AI服务繁忙，以上为基于历史数据的直接提取结果。`;
    }

    if (taskResult && taskResult.total_rows !== undefined) {
      const total = taskResult.total_rows as number;
      const success = (taskResult.success_rows as number) ?? 0;
      const pending = (taskResult.pending_rows as number) ?? 0;
      return `测算任务已创建，共${total}条设备，已匹配${success}条，待处理${pending}条。\n\n` +
        `> AI服务繁忙，请稍后刷新查看完整测算结果。`;
    }

    return '已获取部分结果，但AI服务繁忙，无法生成完整回复。请稍后重试。';
  }

  private extractJson(text: string): string | null {
    const trimmed = text.trim();

    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // continue
    }

    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      const candidate = codeBlockMatch[1].trim();
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // continue
      }
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.substring(firstBrace, lastBrace + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // continue
      }
    }

    return null;
  }

  async getContext(sessionId: string): Promise<AgentContextResponse> {
    const detail = await this.getSession(sessionId);
    const context = this.buildContextString(detail.session, detail.messages);
    return { context };
  }

  private static readonly LINE_TYPE_KEYWORDS: Array<{ keyword: string; lineType: string }> = [
    { keyword: '侧围', lineType: '侧围线' },
    { keyword: '开闭件', lineType: '开闭件线' },
    { keyword: '下车体', lineType: '下车体线' },
    { keyword: '主线', lineType: '主线' },
  ];

  private detectLineTypeFromFileName(fileName: string): string {
    for (const { keyword, lineType } of AgentService.LINE_TYPE_KEYWORDS) {
      if (fileName.includes(keyword)) return lineType;
    }
    return '主线';
  }

  async getTaskStatusForSession(
    sessionId: string,
  ): Promise<AgentTaskStatusResponse> {
    const session = await this.db
      .select()
      .from(agentSession)
      .where(eq(agentSession.id, sessionId))
      .limit(1);

    if (session.length === 0 || !session[0].taskId) {
      return { status: 'no_task' };
    }

    const taskId = session[0].taskId;
    const task = await this.estimateTaskService.getTask(taskId);
    if (!task) {
      return { status: 'no_task' };
    }

    if (task.status === 'processing' || task.status === 'pending') {
      return {
        status: 'processing',
        task_id: taskId,
        total_rows: task.total_rows ?? 0,
      };
    }

    if (task.status === 'failed') {
      return {
        status: 'failed',
        task_id: taskId,
        message: '测算失败，请前往测算工作台重试。',
      };
    }

    const stats = {
      total: task.total_rows ?? 0,
      matched: (task.success_rows ?? 0) + (task.jia_gong_rows ?? 0),
      pending: task.pending_rows ?? 0,
    };

    const ctx = (session[0].context ?? {}) as AgentSessionContext;
    const fName = ctx.file_name ?? '上传文件';
    const detectedLineType = ctx.line_type ?? '主线';

    let summaryMsg: string;
    let metadata: AgentMessageMetadata;

    if (stats.pending > 0) {
      const pendingRows = await this.db
        .select()
        .from(pendingItem)
        .where(and(eq(pendingItem.taskId, taskId), eq(pendingItem.status, 'pending')))
        .limit(50);

      const modelRows = await this.db
        .select({
          modelId: modelTable.modelId,
          modelName: modelTable.modelName,
          applicableType: modelTable.applicableType,
        })
        .from(modelTable)
        .where(eq(modelTable.status, 'published'));

      const devices: DeviceMatchItem[] = [];
      for (const item of pendingRows) {
        const matchedModel = modelRows.find((m) =>
          (m.applicableType ?? '').length >= 2 &&
          (item.deviceName.includes(m.applicableType ?? '') ||
            (m.applicableType ?? '').includes(item.deviceName)),
        );
        devices.push({
          pending_item_id: item.id,
          device_name: item.deviceName,
          matched_model_id: matchedModel?.modelId ?? '',
          matched_model_name: matchedModel?.modelName ?? '无匹配模型',
          confidence: matchedModel ? 0.8 : 0,
          match_reason: matchedModel ? '名称匹配' : '无可用模型',
          alternative_model_id: '',
          alternative_model_name: '',
        });
      }

      summaryMsg = `文件「${fName}」测算完成（识别线别: ${detectedLineType}）。\n\n` +
        `📊 测算统计：\n` +
        `- 设备总数: ${stats.total} 条\n` +
        `- 合同匹配: ${task.success_rows ?? 0} 条\n` +
        `- 甲供设备: ${task.jia_gong_rows ?? 0} 条\n` +
        `- 待处理: ${stats.pending} 条\n\n` +
        `⚠️ 有 ${stats.pending} 条设备未匹配到价格，需要人工填报参数后测算。\n` +
        `可前往测算工作台处理待匹配设备。`;

      metadata = {
        file_name: fName,
        task_id: taskId,
        stats,
        line_type: detectedLineType,
        devices,
      };
    } else {
      const itemsResult = await this.estimateTaskService.getTaskItems(taskId, 1, 20, 'success');
      const summaryLines = itemsResult.items.slice(0, 10).map(
        (it: { device_name: string; price: number | null; source: string; match_level: string }) =>
          `• ${it.device_name}: ${it.price ? it.price.toFixed(1) + ' 元' : '-'} （${it.source}）`,
      );
      const moreHint = itemsResult.total > 10 ? `\n...及其他 ${itemsResult.total - 10} 条` : '';

      summaryMsg = `文件「${fName}」已测算完成（识别线别: ${detectedLineType}）。\n\n` +
        `📊 测算统计：\n` +
        `- 设备总数: ${stats.total} 条\n` +
        `- 合同匹配: ${task.success_rows ?? 0} 条\n` +
        `- 甲供设备: ${task.jia_gong_rows ?? 0} 条\n` +
        `- 待处理: ${stats.pending} 条\n\n` +
        `📋 测算明细（前10条）：\n${summaryLines.join('\n')}${moreHint}\n\n` +
        `可前往测算工作台下载完整结果。`;

      metadata = { file_name: fName, task_id: taskId, stats, line_type: detectedLineType };
    }

    const agentMsg = await this.saveMessage(
      sessionId,
      'agent',
      summaryMsg,
      'summary',
      metadata,
    );

    await this.updateSessionContext(sessionId, {
      task_id: taskId,
      file_name: fName,
      line_type: detectedLineType,
      total_rows: stats.total,
      matched_rows: stats.matched,
      pending_rows: stats.pending,
      current_step: stats.pending > 0 ? 'device_match' : 'complete',
    });

    return {
      status: 'success',
      task_id: taskId,
      agent_message: agentMsg,
    };
  }

  private async processFileUpload(
    userId: string,
    sessionId: string,
    userMessage: AgentMessage,
    rows: EstimateTaskRow[],
    fileName?: string,
  ): Promise<AgentMessage> {
    const fName = fileName || userMessage.content || '上传文件';
    this.logger.log(`processFileUpload: sessionId=${sessionId}, file=${fName}, rows=${rows.length}`);

    const detectedLineType = this.detectLineTypeFromFileName(fName);
    this.logger.log(`文件名识别线别: ${fName} → ${detectedLineType}`);

    const taskResult = await this.estimateTaskService.createTask(userId, {
      file_name: fName,
      line_type: detectedLineType as EstimateTaskRow['line_type'],
      rows,
    });
    const taskId = taskResult.id;

    await this.db
      .update(agentSession)
      .set({ taskId, title: `焊装测算 - ${fName}` })
      .where(eq(agentSession.id, sessionId));

    await this.updateSessionContext(sessionId, {
      task_id: taskId,
      file_name: fName,
      line_type: detectedLineType,
      total_rows: rows.length,
      matched_rows: 0,
      pending_rows: 0,
      current_step: 'processing',
    });

    return this.saveMessage(
      sessionId,
      'agent',
      `文件「${fName}」已上传，识别线别: ${detectedLineType}，共 ${rows.length} 条设备数据。\n\n正在后台进行合同匹配和AI测算，请稍候...`,
      'text',
      { file_name: fName, task_id: taskId, line_type: detectedLineType },
    );
  }

  private async performDeviceMatching(
    taskId: string,
    sessionId: string,
    fileName: string,
    stats: { total: number; matched: number; pending: number },
  ): Promise<AgentMessage> {
    const pendingRows = await this.db
      .select()
      .from(pendingItem)
      .where(and(eq(pendingItem.taskId, taskId), eq(pendingItem.status, 'pending')))
      .limit(50);

    const modelRows = await this.db
      .select({
        modelId: modelTable.modelId,
        modelName: modelTable.modelName,
        applicableType: modelTable.applicableType,
      })
      .from(modelTable)
      .where(eq(modelTable.status, 'published'));

    const modelsJson = JSON.stringify(
      modelRows.map((m) => ({ id: m.modelId, name: m.modelName, type: m.applicableType })),
    );

    const devices: DeviceMatchItem[] = [];
    for (const item of pendingRows) {
      try {
        const result: any = await this.capabilityService
          .load('welding_equipment_intelligent_matching_1')
          .call('textToJson', {
            device_name: item.deviceName,
            available_models: modelsJson,
            spec_description: '',
          });

        devices.push({
          pending_item_id: item.id,
          device_name: item.deviceName,
          matched_model_id: result.matched_model_id || '',
          matched_model_name: result.matched_model_name || '',
          confidence: result.confidence || 0,
          match_reason: result.match_reason || '',
          alternative_model_id: result.alternative_model_id || '',
          alternative_model_name: result.alternative_model_name || '',
        });
      } catch (err) {
        this.logger.error(`Device matching failed for ${item.deviceName}: ${JSON.stringify(err)}`);
        devices.push({
          pending_item_id: item.id,
          device_name: item.deviceName,
          matched_model_id: '',
          matched_model_name: '',
          confidence: 0,
          match_reason: 'AI匹配失败，需手动选择',
          alternative_model_id: '',
          alternative_model_name: '',
        });
      }
    }

    const matchedCount = devices.filter((d) => d.confidence >= 60).length;
    const content = `文件「${fileName}」已解析完成，共 ${stats.total} 条设备数据。\n\n` +
      `匹配结果：历史合同匹配 ${stats.matched} 条，待处理 ${stats.pending} 条。\n\n` +
      `AI已对 ${stats.pending} 条待处理设备进行了智能匹配：\n` +
      `- 高置信度匹配(≥60%)：${matchedCount} 条\n` +
      `- 低置信度/未匹配：${stats.pending - matchedCount} 条\n\n` +
      `请确认下方匹配结果，确认后将自动提取设备参数。`;

    return this.saveMessage(sessionId, 'agent', content, 'device_match', {
      devices,
      task_id: taskId,
      stats,
    });
  }

  private async performParamExtraction(
    devices: DeviceMatchItem[],
    sessionId: string,
  ): Promise<AgentMessage> {
    const paramItems: ParamExtractItem[] = [];

    for (const device of devices) {
      if (!device.matched_model_id || device.confidence < 60) continue;

      await this.db
        .update(pendingItem)
        .set({ modelId: device.matched_model_id })
        .where(eq(pendingItem.id, device.pending_item_id));

      const itemRows = await this.db
        .select()
        .from(pendingItem)
        .where(eq(pendingItem.id, device.pending_item_id))
        .limit(1);
      if (itemRows.length === 0) continue;
      const pItem = itemRows[0];

      const modelRows = await this.db
        .select()
        .from(modelTable)
        .where(eq(modelTable.modelId, device.matched_model_id))
        .limit(1);
      if (modelRows.length === 0) continue;
      const modelRow = modelRows[0];

      const inputVars = (modelRow.inputVars ?? []) as Array<{ name: string; type: string; required: boolean; description?: string }>;
      const params: Record<string, string | number> = {};

      for (const v of inputVars) {
        if (!v.required) continue;
        try {
          const result: any = await this.capabilityService
            .load('welding_equipment_param_extraction_1')
            .call('textToJson', {
              device_name: device.device_name,
              param_name: v.name,
              param_type: v.type,
              description: v.description || '',
            });
          params[v.name] = result.value ?? (v.type === 'number' ? 0 : '');
        } catch (err) {
          this.logger.error(`Param extraction failed for ${v.name}: ${JSON.stringify(err)}`);
          params[v.name] = v.type === 'number' ? 0 : '';
        }
      }

      paramItems.push({
        pending_item_id: device.pending_item_id,
        device_name: device.device_name,
        params,
      });

      await this.db
        .update(pendingItem)
        .set({ filledValues: params, status: 'filled' })
        .where(eq(pendingItem.id, device.pending_item_id));
    }

    const content = `参数提取完成，共处理 ${paramItems.length} 条设备。\n\n` +
      `请确认下方参数提取结果，确认后将执行测算并检查异常。`;

    return this.saveMessage(sessionId, 'agent', content, 'param_extract', { params: paramItems });
  }

  private async performCalculationAndAnomalyCheck(
    params: ParamExtractItem[],
    sessionId: string,
  ): Promise<AgentMessage> {
    const anomalies: AnomalyItem[] = [];
    const devicePrices: Array<{ device_name: string; price: number }> = [];

    for (const item of params) {
      const pItemRows = await this.db
        .select()
        .from(pendingItem)
        .where(eq(pendingItem.id, item.pending_item_id))
        .limit(1);
      if (pItemRows.length === 0) continue;
      const pItem = pItemRows[0];

      const modelRows = await this.db
        .select()
        .from(modelTable)
        .where(eq(modelTable.modelId, pItem.modelId ?? ''))
        .limit(1);
      if (modelRows.length === 0) continue;
      const modelRow = modelRows[0];

      const filledValues = { ...item.params, ...(pItem.filledValues as Record<string, string | number> ?? {}) };
      const price = this.evaluateFormula(modelRow.formulaLogic ?? '0', filledValues);
      devicePrices.push({ device_name: item.device_name, price });

      const historyRows = await this.db
        .select({ unitPrice: contract.unitPrice })
        .from(contract)
        .where(and(eq(contract.deviceMaterialName, item.device_name), eq(contract.status, 'approved')))
        .limit(10);

      if (historyRows.length > 0) {
        const prices = historyRows.map((r) => parseFloat(r.unitPrice ?? '0')).filter((p) => p > 0);
        if (prices.length > 0) {
          const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
          const deviation = avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0;
          const level = Math.abs(deviation) > 30 ? 'critical' : Math.abs(deviation) > 15 ? 'warning' : 'normal';
          if (level !== 'normal') {
            anomalies.push({
              device_name: item.device_name,
              calculated_price: price,
              historical_avg: avgPrice,
              deviation,
              level,
            });
          }
        }
      }
    }

    const taskIdRows = await this.db
      .select({ taskId: agentSession.taskId })
      .from(agentSession)
      .where(eq(agentSession.id, sessionId))
      .limit(1);
    const taskId = taskIdRows[0]?.taskId;

    if (taskId) {
      await this.db
        .update(pendingItem)
        .set({ status: 'submitted' })
        .where(and(eq(pendingItem.taskId, taskId), eq(pendingItem.status, 'filled')));
    }

    const warningCount = anomalies.filter((a) => a.level === 'warning').length;
    const criticalCount = anomalies.filter((a) => a.level === 'critical').length;

    const content = `测算完成，共计算 ${devicePrices.length} 条设备价格。\n\n` +
      `异常检测结果：\n` +
      `- 正常：${devicePrices.length - anomalies.length} 条\n` +
      `- 轻度异常(偏离15%-30%)：${warningCount} 条\n` +
      `- 严重异常(偏离>30%)：${criticalCount} 条\n\n` +
      `请确认是否接受测算结果。`;

    return this.saveMessage(sessionId, 'agent', content, 'anomaly_check', { anomalies, prices: devicePrices });
  }

  private async saveMessage(
    sessionId: string,
    role: string,
    content: string,
    messageType: string,
    metadata?: AgentMessageMetadata,
  ): Promise<AgentMessage> {
    const [row] = await this.db
      .insert(agentMessage)
      .values({
        sessionId,
        role,
        content,
        messageType,
        metadata,
        status: 'sent',
      })
      .returning({
        id: agentMessage.id,
        sessionId: agentMessage.sessionId,
        role: agentMessage.role,
        content: agentMessage.content,
        messageType: agentMessage.messageType,
        metadata: agentMessage.metadata,
        status: agentMessage.status,
        createdAt: agentMessage.createdAt,
      });

    return {
      id: row.id,
      session_id: row.sessionId,
      role: row.role as AgentMessage['role'],
      content: row.content ?? undefined,
      message_type: (row.messageType ?? 'text') as AgentMessage['message_type'],
      metadata: (row.metadata as AgentMessageMetadata) ?? undefined,
      status: (row.status ?? 'sent') as AgentMessage['status'],
      created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  private async updateSessionContext(
    sessionId: string,
    context: Partial<AgentSessionContext>,
  ): Promise<void> {
    await this.db
      .update(agentSession)
      .set({
        context: sql`${agentSession.context} || ${JSON.stringify(context)}::jsonb`,
      })
      .where(eq(agentSession.id, sessionId));
  }

  private buildContextString(session: AgentSession, messages: AgentMessage[]): string {
    const ctx = session.context ?? {};
    const parts: string[] = [
      `当前会话标题：${session.title}`,
      `会话状态：${session.status}`,
    ];
    if (ctx.task_id) parts.push(`关联测算任务ID：${ctx.task_id}`);
    if (ctx.total_rows !== undefined) parts.push(`设备总数：${ctx.total_rows}`);
    if (ctx.matched_rows !== undefined) parts.push(`已匹配：${ctx.matched_rows}`);
    if (ctx.pending_rows !== undefined) parts.push(`待处理：${ctx.pending_rows}`);
    if (ctx.current_step) parts.push(`当前步骤：${ctx.current_step}`);

    const recentMessages = messages.slice(-10);
    if (recentMessages.length > 0) {
      parts.push('\n最近对话记录：');
      for (const msg of recentMessages) {
        const roleLabel = msg.role === 'user' ? '用户' : '助手';
        const contentPreview = (msg.content ?? '').substring(0, 200);
        parts.push(`[${roleLabel}] ${contentPreview}`);
      }
    }

    return parts.join('\n');
  }

  private evaluateFormula(
    formula: string,
    params: Record<string, string | number>,
  ): number {
    let expr = formula;
    expr = expr.replace(/\bmax\s*\(/gi, 'Math.max(');
    expr = expr.replace(/\bmin\s*\(/gi, 'Math.min(');

    const paramNames = Object.keys(params).sort((a, b) => b.length - a.length);
    for (const name of paramNames) {
      const value = params[name];
      const numValue = typeof value === 'number' ? value : Number(value);
      const safeValue = Number.isNaN(numValue) ? 0 : numValue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expr = expr.replace(new RegExp(`\\b${escaped}\\b`, 'g'), String(safeValue));
    }

    if (/[;{}]|=>|function|require|import|process|global|window|document/i.test(expr)) {
      return 0;
    }

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`"use strict"; return (${expr});`);
      const result = fn();
      return typeof result === 'number' && Number.isFinite(result) ? result : 0;
    } catch {
      return 0;
    }
  }

  private isPriceQueryIntent(content: string): boolean {
    const priceQueryKeywords = [
      '价格', '多少钱', '均价', '参考价', '历史价格', '合同价',
      '查询', '查一下', '快查', '价格快查', '价格查询',
    ];
    const lowerContent = content.toLowerCase();
    return priceQueryKeywords.some((kw) => lowerContent.includes(kw));
  }

  private async processPriceQuery(
    sessionId: string,
    content: string,
  ): Promise<AgentMessage> {
    const deviceMatch = content.match(/([\u4e00-\u9fa5]+(?:机器人|夹具|设备|枪|焊机|输送))/);
    const deviceName = deviceMatch ? deviceMatch[1] : '';

    const lineMatch = content.match(/(主线|侧围线|开闭件线|下车体线)/);
    const lineType = lineMatch ? lineMatch[1] : '';

    const toolCall = `🔧 调用 lookup_price(设备=${deviceName || '全部'}, 线别=${lineType || '全部'})`;

    const conditions = [eq(contract.status, 'approved')];
    if (deviceName) {
      conditions.push(like(contract.deviceMaterialName, `%${deviceName}%`));
    }
    if (lineType) {
      conditions.push(eq(contract.lineType, lineType));
    }

    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 12);
    conditions.push(gte(contract.settleDate, recentDate));

    const [rows, statsResult] = await Promise.all([
      this.db
        .select({
          id: contract.id,
          project: contract.project,
          lineType: contract.lineType,
          deviceMaterialName: contract.deviceMaterialName,
          supply: contract.supply,
          unitPrice: contract.unitPrice,
          priceCaliber: contract.priceCaliber,
          settleDate: contract.settleDate,
        })
        .from(contract)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(contract.settleDate))
        .limit(10),
      this.db
        .select({
          avgPrice: avg(sql`CAST(${contract.unitPrice} AS numeric)`),
          minPrice: min(sql`CAST(${contract.unitPrice} AS numeric)`),
          maxPrice: max(sql`CAST(${contract.unitPrice} AS numeric)`),
          cnt: count(),
        })
        .from(contract)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const stats = {
      avg: parseFloat(statsResult[0]?.avgPrice ?? '0'),
      min: parseFloat(statsResult[0]?.minPrice ?? '0'),
      max: parseFloat(statsResult[0]?.maxPrice ?? '0'),
      count: Number(statsResult[0]?.cnt ?? 0),
    };

    if (stats.count === 0) {
      const noDataContent = `${toolCall}\n未找到「${deviceName || content}」的历史合同数据。\n\n建议：\n1. 检查设备名称是否正确\n2. 尝试使用更通用的关键词（如"机器人"代替具体型号）\n3. 前往【历史价格快查】页面进行更精确的筛选查询`;
      return this.saveMessage(sessionId, 'agent', noDataContent, 'text');
    }

    const topRecords = rows.slice(0, 3);
    const sourceParts = topRecords.map((r) => {
      const price = parseFloat(r.unitPrice ?? '0').toFixed(1);
      const cid = (r.project || r.id.slice(0, 6)).toUpperCase();
      return `合同 ${cid}(${price})`;
    });
    const sourceText = sourceParts.join('、');

    const responseContent = `${toolCall}\n` +
      `近12月均价 **${stats.avg.toFixed(1)} 元（未税）**。` +
      `来源：${sourceText}；口径未税。` +
      `（数据来自历史库，非我估算）\n\n` +
      `价格区间：${stats.min.toFixed(1)} - ${stats.max.toFixed(1)} 元，共 ${stats.count} 条记录。` +
      (lineType ? `\n线别：${lineType}` : '') +
      `\n\n如需更详细的筛选（如供货方式、专通用等），请前往【历史价格快查】页面。`;

    return this.saveMessage(sessionId, 'agent', responseContent, 'text');
  }
}
