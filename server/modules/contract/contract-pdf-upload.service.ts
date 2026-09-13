import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { LocalCapabilityService } from '@server/common/capability/local-capability.service';
import { FileStorageService } from '@server/common/file/file-storage.service';
import { randomUUID } from 'crypto';
import type {
  ArchiveDomain,
  ContractRowUnion,
  LineType,
  PdfExtractionStatusResponse,
  PdfUploadChunkRequest,
  PdfUploadChunkResponse,
  PdfUploadCompleteRequest,
  PdfUploadCompleteResponse,
  PdfUploadInitRequest,
  PdfUploadInitResponse,
} from '@shared/api.interface';
import type { FileParseTextOneOutput } from '@shared/plugin-types';
import { serializePluginError } from '@server/common/utils/plugin-call';
import { ContractService } from './contract.service';
import { ImageRecognitionService } from '@server/common/ai/image-recognition.service';

type UploadFileKind = 'pdf' | 'image';

interface StoredUploadSession {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  fileKind: UploadFileKind;
  chunks: Map<number, Buffer>;
  createdAt: number;
  activeTaskId?: string;
}

interface StoredExtractionTask {
  id: string;
  sessionId: string;
  fileName: string;
  status: 'parsing' | 'extracting' | 'completed' | 'failed';
  progress: { done: number; total: number };
  rows?: ContractRowUnion[];
  errorMessage?: string;
  createdAt: number;
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const IMAGE_RECOGNITION_PROMPT = [
  '请仔细识别图片中的表格或清单内容，将每一行明细完整转写为纯文本，逐行输出，一行一条明细。',
  '每行依次转写以下列的值（存在才写，缺失的列直接留空）：项目、线别、设备或材料名称、类别、新增/利旧、复制模式、使用范围、单价、价格口径（含税/未税）、单位、数量、小计、供应商（甲供/乙供）、选定品牌、结算日期、工位编号、工位描述、规格型号、备注。',
  '数值保持原样，不要换算或省略；不要遗漏任何一行；不要添加总结、解释或额外格式。',
].join('');

function imageContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function detectFileKind(fileName: string): UploadFileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'image';
  return null;
}

@Injectable()
export class ContractPdfUploadService {
  private readonly logger = new Logger(ContractPdfUploadService.name);
  private readonly sessions = new Map<string, StoredUploadSession>();
  private readonly tasks = new Map<string, StoredExtractionTask>();

  private static readonly MAX_FILE_BYTES = 30 * 1024 * 1024;
  private static readonly SESSION_TTL_MS = 30 * 60 * 1000;
  private static readonly TASK_TTL_MS = 30 * 60 * 1000;
  private static readonly DOC_PARSE_TIMEOUT_MS = 100000;
  private static readonly IMAGE_RECOGNITION_TIMEOUT_MS = 120000;

  constructor(
    @Inject() private readonly capabilityService: LocalCapabilityService,
    private readonly fileService: FileStorageService,
    private readonly contractService: ContractService,
    private readonly imageRecognitionService: ImageRecognitionService,
  ) {}

  async initPdfUploadSession(dto: PdfUploadInitRequest): Promise<PdfUploadInitResponse> {
    this.purgeExpired();
    if (!dto.file_name || typeof dto.file_size !== 'number' || typeof dto.total_chunks !== 'number') {
      throw new BadRequestException('缺少文件名、文件大小或分片数量');
    }
    const fileKind = detectFileKind(dto.file_name);
    if (!fileKind) {
      throw new BadRequestException('仅支持 PDF 或图片（PNG/JPG/WEBP）文件');
    }
    if (dto.file_size <= 0 || dto.file_size > ContractPdfUploadService.MAX_FILE_BYTES) {
      throw new BadRequestException('文件大小需在 30MB 以内');
    }
    if (!Number.isInteger(dto.total_chunks) || dto.total_chunks < 1 || dto.total_chunks > 256) {
      throw new BadRequestException('分片数量非法');
    }
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      fileName: dto.file_name.slice(0, 200),
      fileSize: dto.file_size,
      totalChunks: dto.total_chunks,
      fileKind,
      chunks: new Map(),
      createdAt: Date.now(),
    });
    this.logger.log(
      `initPdfUploadSession: ${sessionId}, kind=${fileKind}, chunks=${dto.total_chunks}, size=${dto.file_size}`,
    );
    return { session_id: sessionId };
  }

  async appendPdfChunk(dto: PdfUploadChunkRequest): Promise<PdfUploadChunkResponse> {
    const session = this.sessions.get(dto.session_id);
    if (!session) {
      throw new BadRequestException('上传会话不存在或已过期，请重新上传');
    }
    if (!Number.isInteger(dto.index) || dto.index < 0 || dto.index >= session.totalChunks) {
      throw new BadRequestException('分片序号非法');
    }
    if (typeof dto.data !== 'string' || dto.data.length === 0 || dto.data.length > 1024 * 1024) {
      throw new BadRequestException('分片数据非法');
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dto.data)) {
      throw new BadRequestException('分片数据不是合法的 base64');
    }
    session.chunks.set(dto.index, Buffer.from(dto.data, 'base64'));
    return { received: session.chunks.size };
  }

  async completePdfUpload(dto: PdfUploadCompleteRequest): Promise<PdfUploadCompleteResponse> {
    const session = this.sessions.get(dto.session_id);
    if (!session) {
      throw new BadRequestException('上传会话不存在或已过期，请重新上传');
    }
    if (session.chunks.size !== session.totalChunks) {
      throw new BadRequestException(
        `分片未传齐（${session.chunks.size}/${session.totalChunks}），请重新上传`,
      );
    }
    if (session.activeTaskId) {
      const active = this.tasks.get(session.activeTaskId);
      if (active && (active.status === 'parsing' || active.status === 'extracting')) {
        return { task_id: active.id };
      }
    }
    const content = Buffer.concat(
      Array.from(
        { length: session.totalChunks },
        (_, i: number) => session.chunks.get(i) ?? Buffer.alloc(0),
      ),
    );
    if (content.length !== session.fileSize) {
      throw new BadRequestException('分片重组后大小与声明不符，请重新上传');
    }
    const taskId = randomUUID();
    this.tasks.set(taskId, {
      id: taskId,
      sessionId: dto.session_id,
      fileName: session.fileName,
      status: 'parsing',
      progress: { done: 0, total: 0 },
      createdAt: Date.now(),
    });
    session.activeTaskId = taskId;
    this.logger.log(
      `completePdfUpload 启动异步识别: task=${taskId}, session=${dto.session_id}, size=${content.length}, kind=${session.fileKind}, domain=${dto.domain ?? 'welding'}`,
    );
    void this.runExtractionTask(taskId, content, dto.line_type, dto.domain);
    return { task_id: taskId };
  }

  async getExtractionStatus(taskId: string): Promise<PdfExtractionStatusResponse> {
    this.purgeExpired();
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new BadRequestException('识别任务不存在或已过期，请重新上传');
    }
    return {
      task_id: task.id,
      status: task.status,
      progress: task.status === 'extracting' ? task.progress : undefined,
      rows: task.status === 'completed' ? task.rows : undefined,
      error_message: task.status === 'failed' ? task.errorMessage : undefined,
    };
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > ContractPdfUploadService.SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
    for (const [id, task] of this.tasks) {
      if (now - task.createdAt > ContractPdfUploadService.TASK_TTL_MS) {
        this.tasks.delete(id);
      }
    }
  }

  private async runExtractionTask(
    taskId: string,
    content: Buffer,
    lineType: LineType | undefined,
    domain: ArchiveDomain = 'welding',
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    const session = task ? this.sessions.get(task.sessionId) : undefined;
    if (!task || !session) {
      this.logger.error(`识别任务丢失会话: task=${taskId}`);
      return;
    }
    try {
      task.status = 'parsing';
      const text = session.fileKind === 'image'
        ? await this.recognizeImageText(session.fileName, content)
        : await this.parseDocumentText(session.fileName, content);
      if (!text) {
        throw new BadRequestException('未从文件中识别出文本内容，请确认文件内容清晰完整');
      }
      task.status = 'extracting';
      const result = await this.contractService.extractRowsFromText(
        text,
        lineType,
        domain,
        (done: number, total: number) => {
          task.progress = { done, total };
        },
      );
      task.rows = result.rows;
      task.status = 'completed';
      this.sessions.delete(task.sessionId);
      this.logger.log(`识别任务完成: task=${taskId}, rows=${result.rows.length}`);
    } catch (err) {
      task.errorMessage = err instanceof BadRequestException
        ? err.message
        : '合同内容提取失败，请重试或改用 Excel 模板上传';
      task.status = 'failed';
      this.logger.error(
        `识别任务失败（保留会话供重试）: task=${taskId}, err=${serializePluginError(err)}`,
      );
    }
  }

  private async parseDocumentText(fileName: string, content: Buffer): Promise<string> {
    const uploaded = await this.fileService.upload(content, {
      fileName: fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      contentType: 'application/pdf',
    });
    try {
      const signedUrl = await this.fileService.createSignedUrl(uploaded.filePath, 600);
      if (!signedUrl) {
        throw new BadRequestException('PDF 文件获取下载链接失败，请重试');
      }
      const parsed = await this.callWithTimeout(
        'file_parse_text_1',
        'parseDocToMarkdown',
        { fileUrl: [signedUrl] },
        ContractPdfUploadService.DOC_PARSE_TIMEOUT_MS,
      );
      const output = parsed as FileParseTextOneOutput | null;
      const text = typeof output?.content === 'string' ? output.content.trim() : '';
      if (!text) {
        throw new BadRequestException('未从 PDF 中解析出文本内容，请确认文件非扫描件');
      }
      return text;
    } finally {
      await this.fileService.remove([uploaded.filePath]).catch((err: unknown) => {
        this.logger.warn(`临时 PDF 清理失败: ${JSON.stringify(err)}`);
      });
    }
  }

  private async recognizeImageText(fileName: string, content: Buffer): Promise<string> {
    const imageBase64 = content.toString('base64');
    const mimeType = imageContentType(fileName);
    const result = await this.imageRecognitionService.recognizeImage({
      imageBase64,
      mimeType,
      prompt: IMAGE_RECOGNITION_PROMPT,
      timeoutMs: ContractPdfUploadService.IMAGE_RECOGNITION_TIMEOUT_MS,
    });
    const text = result.text.trim();
    if (!text) {
      throw new BadRequestException('未从图片中识别出文本内容，请确认图片清晰完整');
    }
    return text;
  }

  private async callWithTimeout(
    instanceId: string,
    action: string,
    payload: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    const call = this.capabilityService.load(instanceId).call(action, payload);
    call.catch(() => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`插件 ${instanceId} 执行超时`)), timeoutMs);
    });
    const race = Promise.race([call, timeoutPromise]);
    race.finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    });
    return race;
  }
}
