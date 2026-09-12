import { axiosForBackend } from '@client/src/common/platform/axios-instance';
import type {
  ParseContractRequest,
  ContractParseResponse,
   ContractPreviewResponse,
   ContractPreviewResponseUnion,
   ContractArchiveRequest,
  ContractArchiveResponse,
  ArchiveProjectInfoUpdateRequest,
  ArchiveProjectInfoUpdateResponse,
  ContractArchiveLogsResponse,
   ContractReviewListResponse,
   ContractReviewActionRequest,
  ContractReviewActionResponse,
  ContractReviewDetailResponse,
  ExtractPdfContractsRequest,
  ExtractPdfContractsResponse,
  ArchiveDomain,
  } from '@shared/api.interface';

export async function extractPdfContracts(
  data: ExtractPdfContractsRequest,
): Promise<ExtractPdfContractsResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/extract-pdf',
    method: 'POST',
    data,
  });
  return response.data;
}

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
): Promise<ContractPreviewResponseUnion> {
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

export async function getArchiveLogs(limit: number, domain: ArchiveDomain): Promise<ContractArchiveLogsResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/archives/logs',
    method: 'GET',
    params: { limit, domain },
  });
  return response.data;
}

export async function updateArchiveProject(
  data: ArchiveProjectInfoUpdateRequest,
): Promise<ArchiveProjectInfoUpdateResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/archives/projects/update',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function deleteArchivedContracts(
  ids: string[],
  domain: ArchiveDomain,
): Promise<{ success: boolean; deletedCount: number }> {
  const response = await axiosForBackend({
    url: '/api/contracts/archives',
    method: 'DELETE',
    data: { ids, domain },
  });
  return response.data;
}

export async function getPendingReviews(domain: ArchiveDomain): Promise<ContractReviewListResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/reviews/pending',
    method: 'GET',
    params: { domain },
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
  domain: ArchiveDomain,
): Promise<ContractReviewDetailResponse> {
  const response = await axiosForBackend({
    url: '/api/contracts/reviews/batch-detail',
    method: 'GET',
    params: { batchId, page, pageSize, domain },
  });
  return response.data;
}
