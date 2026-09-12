import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ParseContractRequest,
  ContractParseResponse,
  ContractPreviewResponse,
  ContractArchiveRequest,
  ContractArchiveResponse,
  ContractArchiveLogsResponse,
   ContractReviewListResponse,
   ContractReviewActionRequest,
   ContractReviewActionResponse,
   ContractReviewDetailResponse,
 } from '@shared/api.interface';

export async function parseContract(data: ParseContractRequest): Promise<ContractParseResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/parse',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function getContractPreview(
  previewId: string,
  page: number,
  pageSize: number,
): Promise<ContractPreviewResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/preview',
    method: 'GET',
    params: { previewId, page, pageSize },
  });
  return response.data;
}

export async function archiveContracts(data: ContractArchiveRequest): Promise<ContractArchiveResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/archive',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function getArchiveLogs(limit: number): Promise<ContractArchiveLogsResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/archives/logs',
    method: 'GET',
    params: { limit },
  });
  return response.data;
}

export async function deleteArchivedContracts(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
  const response = await axiosForBackend({
    url: '/api/contracts/archives',
    method: 'DELETE',
    data: { ids },
  });
  return response.data;
}

export async function getPendingReviews(): Promise<ContractReviewListResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/reviews/pending',
    method: 'GET',
  });
  return response.data;
}

export async function approveBatch(data: ContractReviewActionRequest): Promise<ContractReviewActionResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/reviews/approve',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function rejectBatch(data: ContractReviewActionRequest): Promise<ContractReviewActionResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/reviews/reject',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function getBatchDetail(
  batchId: string,
  page: number,
  pageSize: number,
): Promise<ContractReviewDetailResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/reviews/batch-detail',
    method: 'GET',
    params: { batchId, page, pageSize },
  });
  return response.data;
}
