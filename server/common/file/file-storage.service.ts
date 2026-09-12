import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  async upload(content: Buffer, options: { fileName: string; contentType?: string }) {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const filePath = `${Date.now()}-${options.fileName}`;
    const fullPath = path.join(this.uploadDir, filePath);
    await fs.writeFile(fullPath, content);
    return { filePath, fileName: options.fileName };
  }

  async createSignedUrl(filePath: string, ttlSeconds: number) {
    const fullPath = path.join(this.uploadDir, filePath);
    try {
      await fs.access(fullPath);
      return `file://${fullPath}`;
    } catch {
      return null;
    }
  }

  async getFileMetadata(filePath: string) {
    const fullPath = path.join(this.uploadDir, filePath);
    try {
      const stat = await fs.stat(fullPath);
      return { filePath, size: stat.size };
    } catch {
      return null;
    }
  }

  async remove(filePaths: string[]) {
    for (const fp of filePaths) {
      const fullPath = path.join(this.uploadDir, fp);
      await fs.unlink(fullPath).catch((err) => this.logger.warn(`删除文件失败: ${fp}`, err));
    }
  }
}
