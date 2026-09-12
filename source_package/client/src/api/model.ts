import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ModelListResponse,
  SaveModelRequest,
  SaveModelResponse,
  TryoutRequest,
  TryoutResponse,
  PublishModelResponse,
  ModelVersionsResponse,
} from '@shared/api.interface';

export async function getModels(page: number, pageSize: number): Promise<ModelListResponse> {
  const response = await axiosForBackend({
    url: '/api/models',
    method: 'GET',
    params: { page, pageSize },
  });
  return response.data;
}

export async function saveModel(data: SaveModelRequest): Promise<SaveModelResponse> {
  const response = await axiosForBackend({
    url: '/api/models',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function tryoutModel(id: string, data: TryoutRequest): Promise<TryoutResponse> {
  const response = await axiosForBackend({
    url: `/api/models/${id}/tryout`,
    method: 'POST',
    data,
  });
  return response.data;
}

export async function tryoutModelByModelId(model_id: string, data: TryoutRequest): Promise<TryoutResponse> {
  const response = await axiosForBackend({
    url: '/api/models/tryout-by-model-id',
    method: 'POST',
    data: { model_id, params: data.params },
  });
  return response.data;
}

export async function publishModel(id: string): Promise<PublishModelResponse> {
  const response = await axiosForBackend({
    url: `/api/models/${id}/publish`,
    method: 'POST',
  });
  return response.data;
}

export async function deleteModel(id: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/models/${id}`,
    method: 'DELETE',
  });
  return response.data;
}

export async function getModelVersions(id: string, page: number, pageSize: number): Promise<ModelVersionsResponse> {
  const response = await axiosForBackend({
    url: `/api/models/${id}/versions`,
    method: 'GET',
    params: { page, pageSize },
  });
  return response.data;
}
