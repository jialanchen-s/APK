import { axiosForBackend } from '@client/src/common/platform/axios-instance';
import type {
  CreateAgentSessionRequest,
  CreateAgentSessionResponse,
  AgentSessionListResponse,
  AgentSessionDetailResponse,
  SendAgentMessageRequest,
  SendAgentMessageResponse,
  AgentActionResponse,
  AgentContextResponse,
  AgentChatRequest,
  AgentChatResponse,
  AgentTaskStatusResponse,
  ExtractDeviceParamsRequest,
  ExtractDeviceParamsResponse,
} from '@shared/api.interface';

export async function createAgentSession(
  data: CreateAgentSessionRequest,
): Promise<CreateAgentSessionResponse> {
  const response = await axiosForBackend({
    url: '/api/agent/sessions',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function listAgentSessions(
  page: number = 1,
  pageSize: number = 20,
): Promise<AgentSessionListResponse> {
  const response = await axiosForBackend({
    url: '/api/agent/sessions',
    method: 'GET',
    params: { page, pageSize },
  });
  return response.data;
}

export async function getAgentSession(id: string): Promise<AgentSessionDetailResponse> {
  const response = await axiosForBackend({
    url: `/api/agent/sessions/${id}`,
    method: 'GET',
  });
  return response.data;
}

export async function sendAgentMessage(
  sessionId: string,
  data: SendAgentMessageRequest,
): Promise<SendAgentMessageResponse> {
  const response = await axiosForBackend({
    url: `/api/agent/sessions/${sessionId}/messages`,
    method: 'POST',
    data,
  });
  return response.data;
}

export async function confirmAgentAction(
  sessionId: string,
  messageId: string,
): Promise<AgentActionResponse> {
  const response = await axiosForBackend({
    url: `/api/agent/sessions/${sessionId}/actions/${messageId}/confirm`,
    method: 'POST',
  });
  return response.data;
}

export async function rejectAgentAction(
  sessionId: string,
  messageId: string,
): Promise<AgentActionResponse> {
  const response = await axiosForBackend({
    url: `/api/agent/sessions/${sessionId}/actions/${messageId}/reject`,
    method: 'POST',
  });
  return response.data;
}

export async function getAgentContext(
  sessionId: string,
): Promise<AgentContextResponse> {
  const response = await axiosForBackend({
    url: `/api/agent/sessions/${sessionId}/context`,
    method: 'GET',
  });
  return response.data;
}

export async function agentChat(
  sessionId: string,
  data: AgentChatRequest,
): Promise<AgentChatResponse> {
  const response = await axiosForBackend({
    url: `/api/agent/sessions/${sessionId}/chat`,
    method: 'POST',
    data,
  });
  return response.data;
}

export async function getAgentTaskStatus(
  sessionId: string,
): Promise<AgentTaskStatusResponse> {
  const response = await axiosForBackend({
    url: `/api/agent/sessions/${sessionId}/task-status`,
    method: 'GET',
  });
  return response.data;
}

export async function deleteAgentSession(sessionId: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/agent/sessions/${sessionId}`,
    method: 'DELETE',
  });
  return response.data;
}

export async function extractDeviceParams(
  data: ExtractDeviceParamsRequest,
): Promise<ExtractDeviceParamsResponse> {
  const response = await axiosForBackend({
    url: '/api/agent/extract-device-params',
    method: 'POST',
    data,
  });
  return response.data;
}
