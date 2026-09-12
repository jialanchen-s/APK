import { axiosForBackend } from '@client/src/common/platform/axios-instance';
import { logger } from '@client/src/common/platform/logger';
import type {
  ArchiveDomain,
  ContractRowUnion,
  LineType,
  PdfExtractionStatusResponse,
  PdfUploadChunkResponse,
  PdfUploadCompleteResponse,
  PdfUploadInitResponse,
} from '@shared/api.interface';

const CHUNK_SIZE = 512 * 1024;
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

export interface ContractParseProgress {
  stage: 'uploading' | 'parsing' | 'extracting';
  done?: number;
  total?: number;
}

function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'));
    reader.readAsDataURL(blob);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function parseContractFile(
  file: File,
  lineType: LineType | undefined,
  domain: ArchiveDomain = 'welding',
  onProgress?: (progress: ContractParseProgress) => void,
): Promise<ContractRowUnion[]> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('文件超过 30MB 上限，请压缩或拆分后重试');
  }
  const lower = file.name.toLowerCase();
  const isPdf = lower.endsWith('.pdf');
  const isImage = IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!isPdf && !isImage) {
    throw new Error('仅支持 PDF 或图片（PNG/JPG/WEBP）文件');
  }

  onProgress?.({ stage: 'uploading' });
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const initRes = await axiosForBackend.post<PdfUploadInitResponse>(
    '/api/contracts/pdf-upload/init',
    {
      file_name: file.name,
      file_size: file.size,
      total_chunks: totalChunks,
      file_type: isPdf ? 'pdf' : 'image',
    },
  );
  const sessionId = initRes.data?.session_id;
  if (!sessionId) {
    throw new Error('初始化上传失败');
  }
  try {
    for (let index = 0; index < totalChunks; index += 1) {
      const blob = file.slice(index * CHUNK_SIZE, Math.min((index + 1) * CHUNK_SIZE, file.size));
      const data = await readBlobAsBase64(blob);
      const chunkRes = await axiosForBackend.post<PdfUploadChunkResponse>(
        '/api/contracts/pdf-upload/chunk',
        { session_id: sessionId, index, data },
      );
      if (chunkRes.data?.received !== index + 1) {
        throw new Error(`分片 ${index + 1}/${totalChunks} 上传异常`);
      }
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('分片上传失败');
  }

  const completeRes = await axiosForBackend.post<PdfUploadCompleteResponse>(
    '/api/contracts/pdf-upload/complete',
    { session_id: sessionId, line_type: lineType, domain },
  );
  const taskId = completeRes.data?.task_id;
  if (!taskId) {
    throw new Error('识别任务创建失败，请重试');
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) {
      throw new Error('文件识别超时，请稍后重试或改用 Excel 模板上传');
    }
    const statusRes = await axiosForBackend.get<PdfExtractionStatusResponse>(
      `/api/contracts/pdf-upload/status/${taskId}`,
    );
    const status = statusRes.data;
    if (!status || !status.status) {
      throw new Error('识别状态查询失败，请重试');
    }
    if (status.status === 'completed') {
      return status.rows ?? [];
    }
    if (status.status === 'failed') {
      throw new Error(status.error_message || '合同内容提取失败，请重试或改用 Excel 模板上传');
    }
    onProgress?.({
      stage: status.status,
      done: status.progress?.done,
      total: status.progress?.total,
    });
    logger.info('合同识别进行中', { task: taskId, status: status.status });
    await sleep(POLL_INTERVAL_MS);
  }
}
