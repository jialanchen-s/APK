import { axiosForBackend } from '@client/src/common/platform/axios-instance';

export interface AIProviderConfig {
  apiKey?: string;
  model?: string;
  visionModel?: string;
  baseUrl?: string;
  organization?: string;
  name?: string;
  _configured?: boolean;
}

export interface AIProviderSettings {
  defaultProvider: string;
  providers: Record<string, AIProviderConfig>;
}

export interface AIStatusResponse {
  defaultProvider: string;
  activeAdapter: string | null;
  registeredAdapters: string[];
}

export async function getAIConfig(): Promise<AIProviderSettings> {
  const response = await axiosForBackend({
    url: '/api/settings/ai-config',
    method: 'GET',
  });
  return response.data;
}

export async function updateAIConfig(data: AIProviderSettings): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: '/api/settings/ai-config',
    method: 'PUT',
    data,
  });
  return response.data;
}

export async function getAIStatus(): Promise<AIStatusResponse> {
  const response = await axiosForBackend({
    url: '/api/settings/ai-config/status',
    method: 'GET',
  });
  return response.data;
}

export interface ImageRecognitionResponse {
  text: string;
  model: string;
  adapter: string;
}

export async function recognizeImage(params: {
  imageBase64: string;
  mimeType: string;
  prompt?: string;
}): Promise<ImageRecognitionResponse> {
  const response = await axiosForBackend({
    url: '/api/settings/image-recognition',
    method: 'POST',
    data: params,
  });
  return response.data;
}

export interface ParseDocumentResponse {
  content: string;
  pageCount?: number;
}

export async function parseDocument(params: {
  fileBase64: string;
  fileName: string;
}): Promise<ParseDocumentResponse> {
  const response = await axiosForBackend({
    url: '/api/settings/parse-document',
    method: 'POST',
    data: params,
  });
  return response.data;
}
