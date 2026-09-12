import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useDropzone } from 'react-dropzone';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import {
  Bot, Plus, Send, Paperclip, Loader2, MessageSquare,
  Wrench, Brain, ShieldAlert, ChevronDown, Trash2, MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  listAgentSessions,
  createAgentSession,
  getAgentSession,
  sendAgentMessage,
  confirmAgentAction,
  rejectAgentAction,
  agentChat,
  deleteAgentSession,
  getAgentTaskStatus,
} from '@client/src/api/agent';
import { parseExcelRows } from '../EstimateWorkbench/excel-parser';
import AgentMessageBubble from './AgentMessageBubble';
import AgentCapabilityPanel from './AgentCapabilityPanel';
import type { AgentSession, AgentMessage } from '@shared/api.interface';

const AgentChat: React.FC = () => {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<AgentSession | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await listAgentSessions(1, 50);
      setSessions(res.items);
      if (res.items.length > 0 && !currentSessionId) {
        setCurrentSessionId(res.items[0].id);
      }
    } catch (err) {
      logger.error('加载会话列表失败:', JSON.stringify(err));
    } finally {
      setLoadingSessions(false);
    }
  }, [currentSessionId]);

  const pollTaskStatus = useCallback(async (sid: string) => {
    try {
      const res = await getAgentTaskStatus(sid);
      if (res.status === 'success' && res.agent_message) {
        if (res.task_id) {
          sessionStorage.setItem('estimate_task_id', res.task_id);
        }
        setMessages(prev => {
          if (prev.some(m => m.id === res.agent_message!.id)) return prev;
          return [...prev, res.agent_message!];
        });
        toast.success('测算完成', { description: '可前往测算工作台查看完整结果' });
      } else if (res.status === 'failed') {
        setMessages(prev => [...prev, {
          id: `task-fail-${Date.now()}`,
          session_id: sid,
          role: 'agent',
          content: res.message ?? '测算失败，请前往测算工作台重试。',
          message_type: 'summary',
          status: 'sent',
          created_at: new Date().toISOString(),
        }]);
        toast.error('测算失败', { description: res.message ?? '请稍后重试' });
      } else if (res.status === 'processing') {
        pollTimerRef.current = setTimeout(() => pollTaskStatus(sid), 3000);
      }
    } catch {
      pollTimerRef.current = setTimeout(() => pollTaskStatus(sid), 5000);
    }
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true);
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    try {
      const res = await getAgentSession(sessionId);
      setMessages(res.messages);
      const lastAgentMsg = [...res.messages].reverse().find(m => m.role === 'agent');
      if (lastAgentMsg?.metadata?.task_id && 
          typeof lastAgentMsg.content === 'string' && 
          lastAgentMsg.content.includes('正在后台')) {
        pollTaskStatus(sessionId);
      }
    } catch (err) {
      logger.error('加载消息失败:', JSON.stringify(err));
    } finally {
      setLoadingMessages(false);
    }
  }, [pollTaskStatus]);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => {
    if (currentSessionId) loadMessages(currentSessionId);
    else setMessages([]);
  }, [currentSessionId, loadMessages]);
  useEffect(() => { scrollToBottom(); }, [messages, isThinking, scrollToBottom]);
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const handleNewSession = useCallback(async () => {
    try {
      const res = await createAgentSession({ title: '新建测算会话' });
      const newSession: AgentSession = {
        id: res.id,
        title: res.title,
        status: res.status,
        created_at: res.created_at,
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(res.id);
      setMessages([]);
      setShowSessionList(false);
    } catch (err) {
      logger.error('创建会话失败:', JSON.stringify(err));
      toast.error('创建会话失败');
    }
  }, []);

  const handleDeleteSession = useCallback(async (session: AgentSession) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteSession = useCallback(async () => {
    if (!sessionToDelete) return;
    try {
      await deleteAgentSession(sessionToDelete.id);
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      if (currentSessionId === sessionToDelete.id) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      toast.success('会话已删除');
    } catch (err) {
      logger.error('删除会话失败:', JSON.stringify(err));
      toast.error('删除会话失败');
    } finally {
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  }, [sessionToDelete, currentSessionId]);

  const handleSendText = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !currentSessionId || isThinking) return;

    setInputText('');
    setIsThinking(true);

    const tempUserMsg: AgentMessage = {
      id: `temp-${Date.now()}`,
      session_id: currentSessionId,
      role: 'user',
      content: text,
      message_type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await agentChat(currentSessionId, { content: text });

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        res.message,
        res.agentMessage,
      ]);
    } catch (err) {
      logger.error('Agent回复失败:', JSON.stringify(err));
      toast.error('Agent回复失败，请重试');
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setIsThinking(false);
    }
  }, [inputText, currentSessionId, isThinking]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !currentSessionId || fileUploading) return;

    setFileUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetData = XLSX.utils.sheet_to_json<(string | number)[]>(
        firstSheet,
        { header: 1, defval: '' },
      );
      const rows = parseExcelRows(sheetData);

      if (rows.length === 0) {
        toast.error('解析失败', { description: '未识别到有效数据行，请检查Excel列名' });
        return;
      }

      const tempUserMsg: AgentMessage = {
        id: `temp-upload-${Date.now()}`,
        session_id: currentSessionId,
        role: 'user',
        content: file.name,
        message_type: 'file_upload',
        status: 'sent',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempUserMsg]);

      const res = await sendAgentMessage(currentSessionId, {
        role: 'user',
        content: file.name,
        message_type: 'file_upload',
        rows,
        metadata: { file_name: file.name },
      });

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        res.message,
        ...(res.agentMessage ? [res.agentMessage] : []),
      ]);

      toast.success('文件已上传', { description: `共 ${rows.length} 行数据，开始智能分析` });

      pollTaskStatus(currentSessionId);
    } catch (err) {
      logger.error('文件上传失败:', JSON.stringify(err));
      toast.error('上传失败', { description: '文件解析或提交出错' });
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-upload-')));
    } finally {
      setFileUploading(false);
    }
  }, [currentSessionId, fileUploading]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    disabled: fileUploading || !currentSessionId,
    noClick: true,
    noDrag: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onDrop([file]);
    e.target.value = '';
  };

  const handleConfirm = useCallback(async (messageId: string) => {
    if (!currentSessionId || actionLoading) return;
    setActionLoading(messageId);
    try {
      const res = await confirmAgentAction(currentSessionId, messageId);
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, status: 'confirmed' } : m,
      ));
      if (res.agentMessage) {
        setMessages(prev => [...prev, res.agentMessage!]);
      }
    } catch (err) {
      logger.error('确认操作失败:', JSON.stringify(err));
      toast.error('操作失败，请重试');
    } finally {
      setActionLoading(null);
    }
  }, [currentSessionId, actionLoading]);

  const handleReject = useCallback(async (messageId: string) => {
    if (!currentSessionId || actionLoading) return;
    setActionLoading(messageId);
    try {
      const res = await rejectAgentAction(currentSessionId, messageId);
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, status: 'rejected' } : m,
      ));
      if (res.agentMessage) {
        setMessages(prev => [...prev, res.agentMessage!]);
      }
    } catch (err) {
      logger.error('跳过操作失败:', JSON.stringify(err));
      toast.error('操作失败，请重试');
    } finally {
      setActionLoading(null);
    }
  }, [currentSessionId, actionLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        loading={loadingSessions}
        onSelect={(id) => { setCurrentSessionId(id); setShowSessionList(false); }}
        onNew={handleNewSession}
        onDelete={handleDeleteSession}
        show={showSessionList}
        onClose={() => setShowSessionList(false)}
      />

      <DeleteSessionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        session={sessionToDelete}
        onConfirm={confirmDeleteSession}
      />

      <div className="flex flex-1 min-w-0">
        <div className="flex flex-1 flex-col min-w-0">
          <ChatHeader
            onToggleSessions={() => setShowSessionList(!showSessionList)}
          />

          {!currentSessionId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold tracking-tight">AI 智能助手</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  自然语言操作系统 + 分析顾问。算价走确定性引擎、必带溯源，绝不编造价格。
                </p>
              </div>
              <Button className="rounded-full" onClick={handleNewSession}>
                <Plus className="mr-1.5 size-4" />
                开始新对话
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-h-[calc(100vh-180px)]"
              >
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MessageSquare className="size-8 mb-2 opacity-50" />
                    <p className="text-sm">上传 Excel 设备清单开始测算，或输入问题与我对话</p>
                    <p className="text-xs mt-1 text-muted-foreground/70">
                      如"涂胶机器人主线历史价多少？""本月有多少待人工？"
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map(msg => (
                      <AgentMessageBubble
                        key={msg.id}
                        message={msg}
                        onConfirm={handleConfirm}
                        onReject={handleReject}
                        actionLoading={actionLoading}
                      />
                    ))}
                    {isThinking && (
                      <div className="flex gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
                          <Bot className="size-4 text-violet-600" />
                        </div>
                        <div className="max-w-[80%]">
                          <div className="rounded-2xl bg-white border border-border px-3 py-2.5 text-sm">
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Brain className="size-3.5 text-violet-500 animate-pulse" />
                              <span>Agent 正在思考...</span>
                              <span className="inline-flex gap-0.5">
                                <span className="size-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="size-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="size-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <ChatInput
                inputText={inputText}
                setInputText={setInputText}
                onKeyDown={handleKeyDown}
                onSend={handleSendText}
                onFileClick={handleFileClick}
                fileInputRef={fileInputRef}
                getRootProps={getRootProps}
                getInputProps={getInputProps}
                handleFileChange={handleFileChange}
                disabled={isThinking || fileUploading}
                fileUploading={fileUploading}
              />
            </>
          )}
        </div>

        <AgentCapabilityPanel />
      </div>
    </div>
  );
};

const DeleteSessionDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AgentSession | null;
  onConfirm: () => void;
}> = ({ open, onOpenChange, session, onConfirm }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="rounded-3xl">
      <AlertDialogHeader>
        <AlertDialogTitle>删除会话</AlertDialogTitle>
        <AlertDialogDescription>
          确定要删除会话「{session?.title || ''}」吗？此操作不可恢复，会话中的所有消息也将被删除。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="rounded-full">取消</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          删除
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const ChatHeader: React.FC<{
  onToggleSessions: () => void;
}> = ({ onToggleSessions }) => (
  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" className="lg:hidden rounded-full" onClick={onToggleSessions}>
        <MessageSquare className="size-4" />
      </Button>
      <span className="text-sm font-bold tracking-tight">对话</span>
    </div>
  </div>
);

const ChatInput: React.FC<{
  inputText: string;
  setInputText: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onFileClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  getRootProps: any;
  getInputProps: any;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
  fileUploading: boolean;
}> = ({
  inputText, setInputText, onKeyDown, onSend, onFileClick,
  fileInputRef, getRootProps, getInputProps, handleFileChange,
  disabled, fileUploading,
}) => (
  <div className="border-t border-border p-3">
    <div className="flex items-end gap-2">
      <div {...getRootProps()} className="shrink-0">
        <input {...getInputProps()} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          size="icon"
          variant="outline"
          className="rounded-full"
          onClick={onFileClick}
          disabled={disabled}
        >
          {fileUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
        </Button>
      </div>
      <textarea
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder='用自然语言提问或下指令，如"把这台改造设备用白盒算一下""本月有多少待人工"'
        rows={1}
        className="flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[40px] max-h-[120px]"
        disabled={disabled}
        style={{ height: 'auto' }}
        onInput={e => {
          const el = e.target as HTMLTextAreaElement;
          el.style.height = 'auto';
          el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
        }}
      />
      <Button
        size="icon"
        className="rounded-full"
        onClick={onSend}
        disabled={!inputText.trim() || disabled}
      >
        {disabled ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
      </Button>
    </div>
  </div>
);

const SessionSidebar: React.FC<{
  sessions: AgentSession[];
  currentSessionId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (session: AgentSession) => void;
  show: boolean;
  onClose: () => void;
}> = ({ sessions, currentSessionId, loading, onSelect, onNew, onDelete, show, onClose }) => (
  <>
    {show && (
      <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={onClose} />
    )}
    <div className={cn(
      'fixed lg:relative z-50 lg:z-0 w-64 shrink-0 flex-col border-r border-border bg-muted/30',
      'lg:flex',
      show ? 'flex h-full' : 'hidden lg:flex',
    )}>
      <div className="p-3 border-b border-border">
        <Button className="w-full rounded-full" variant="default" onClick={onNew}>
          <Plus className="mr-1.5 size-4" />
          新建测算会话
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              暂无会话
            </div>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                className={cn(
                  'group flex items-center justify-between rounded-2xl px-3 py-2 text-sm transition-colors',
                  currentSessionId === s.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted',
                )}
              >
                <button
                  onClick={() => onSelect(s.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      'text-[10px] px-1 py-0.5 rounded-full',
                      s.status === 'active' ? 'bg-primary/10 text-primary' :
                      s.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-muted text-muted-foreground',
                    )}>
                      {s.status === 'active' ? '进行中' : s.status === 'completed' ? '已完成' : s.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(s); }}
                  className="ml-1.5 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-red-50 hover:text-red-500"
                  title="删除会话"
                  style={{ color: '#9CA3AF' }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </>
);

export default AgentChat;
