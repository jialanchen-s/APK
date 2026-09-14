import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

export interface ParseDocumentResult {
  content: string;
  pageCount?: number;
}

@Injectable()
export class DocumentParsingService {
  private readonly logger = new Logger(DocumentParsingService.name);

  async parseBuffer(buffer: Buffer, fileName: string): Promise<ParseDocumentResult> {
    const lower = fileName.toLowerCase();

    if (lower.endsWith('.pdf')) {
      return this.parsePdf(buffer);
    }

    if (lower.endsWith('.docx')) {
      return this.parseDocx(buffer);
    }

    if (lower.endsWith('.doc')) {
      throw new BadRequestException('不支持旧版 .doc 格式，请转换为 .docx 或 .pdf 后重试');
    }

    throw new BadRequestException(`不支持的文件类型: ${fileName}`);
  }

  private async parsePdf(buffer: Buffer): Promise<ParseDocumentResult> {
    try {
      const result = await pdfParse(buffer);
      const content = result.text?.trim() ?? '';
      this.logger.log(`PDF parsed: ${result.numpages} pages, ${content.length} chars`);
      return { content, pageCount: result.numpages };
    } catch (err) {
      this.logger.error(`PDF parse failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('PDF 解析失败，请确认文件非扫描件且内容完整');
    }
  }

  private async parseDocx(buffer: Buffer): Promise<ParseDocumentResult> {
    try {
      const result = await mammoth.convertToMarkdown({ buffer });
      const content = result.value.trim();
      if (result.messages.length > 0) {
        this.logger.warn(`DOCX warnings: ${JSON.stringify(result.messages.slice(0, 5))}`);
      }
      this.logger.log(`DOCX parsed: ${content.length} chars`);
      return { content };
    } catch (err) {
      this.logger.error(`DOCX parse failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('Word 文档解析失败，请确认文件格式正确');
    }
  }
}
