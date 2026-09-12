import { axiosForBackend } from '@client/src/common/platform/axios-instance';
import type {
  CreateEstimateTaskRequest,
  CreateEstimateTaskResponse,
  EstimateTask,
  EstimateTaskItemListResponse,
  EstimateItemFilter,
  AnomalyDetectionResult,
  ContractProjectsResponse,
  ArchiveDomain,
} from '@shared/api.interface';

export async function createEstimateTask(data: CreateEstimateTaskRequest): Promise<CreateEstimateTaskResponse> {
  const response = await axiosForBackend({
    url: '/api/estimate-tasks',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function getContractProjects(domain: ArchiveDomain = 'welding'): Promise<ContractProjectsResponse> {
  const response = await axiosForBackend({
    url: '/api/estimate-tasks/contract-projects',
    method: 'GET',
    params: { domain },
  });
  return response.data;
}

export async function getEstimateTask(id: string): Promise<EstimateTask> {
  const response = await axiosForBackend({
    url: `/api/estimate-tasks/${id}`,
    method: 'GET',
  });
  return response.data;
}

export async function getEstimateTaskItems(
  id: string,
  page: number,
  pageSize: number,
  filter: EstimateItemFilter,
): Promise<EstimateTaskItemListResponse> {
  const response = await axiosForBackend({
    url: `/api/estimate-tasks/${id}/items`,
    method: 'GET',
    params: { page, pageSize, filter },
  });
  return response.data;
}

export async function getAnomalyResult(taskId: string): Promise<AnomalyDetectionResult | null> {
  const response = await axiosForBackend({
    url: `/api/estimate-tasks/${taskId}/anomaly`,
    method: 'GET',
  });
  return response.data;
}
