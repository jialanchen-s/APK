import { axiosForBackend } from '@client/src/common/platform/axios-instance';
import type {
  PendingGroupsResponse,
  PendingItemListResponse,
  PendingGroupType,
  BatchApplyRequest,
  BatchApplyResponse,
  SubmitPendingRequest,
  SubmitPendingResponse,
  ApplyModelRequest,
  ApplyModelResponse,
} from '@shared/api.interface';

export async function getPendingGroups(taskId: string): Promise<PendingGroupsResponse> {
  const response = await axiosForBackend({
    url: '/api/pending-items/groups',
    method: 'GET',
    params: { taskId },
  });
  return response.data;
}

export async function getPendingItems(
  taskId: string,
  groupType: PendingGroupType,
  page: number,
  pageSize: number,
): Promise<PendingItemListResponse> {
  const response = await axiosForBackend({
    url: '/api/pending-items',
    method: 'GET',
    params: { taskId, groupType, page, pageSize },
  });
  return response.data;
}

export async function batchApplyParams(data: BatchApplyRequest): Promise<BatchApplyResponse> {
  const response = await axiosForBackend({
    url: '/api/pending-items/batch-apply',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function submitPendingItems(data: SubmitPendingRequest): Promise<SubmitPendingResponse> {
  const response = await axiosForBackend({
    url: '/api/pending-items/submit',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function getLatestTask(): Promise<{ id: string; file_name: string; status: string } | null> {
  const response = await axiosForBackend({
    url: '/api/pending-items/latest-task',
    method: 'GET',
  });
  return response.data;
}

export async function resetTaskPendingItems(taskId: string): Promise<void> {
  await axiosForBackend({
    url: '/api/pending-items/reset',
    method: 'POST',
    data: { taskId },
  });
}

export async function applyModel(data: ApplyModelRequest): Promise<ApplyModelResponse> {
  const response = await axiosForBackend({
    url: '/api/pending-items/apply-model',
    method: 'POST',
    data,
  });
  return response.data;
}
