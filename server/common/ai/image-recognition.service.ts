import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from './ai-gateway.service';
import type { ChatMessage } from './llm-adapter.interface';

const DEFAULT_IMAGE_RECOGNITION_PROMPT =
  '请仔细识别图片中的表格或清单内容，将每一行明细完整转写为纯文本，逐行输出，一行一条明细。每行依次转写以下列的值（存在才写，缺失的列直接留空）：项目、线别、设备或材料名称、类别、新增/利旧、复制模式、使用范围、单价、价格口径（含税/未税）、单位、数量、小计、供应商（甲供/乙供）、选定品牌、结算日期、工位编号、工位描述、规格型号、备注。数值保持原样，不要换算或省略；不要遗漏任何一行；不要添加总结、解释或额外格式。';

export interface ImageRecognitionResult {
  text: string;
  model: string;
  adapter: string;
}

@Injectable()
export class ImageRecognitionService {
  private readonly logger = new Logger(ImageRecognitionService.name);

  constructor(private readonly gateway: AIGatewayService) {}

  async recognizeImage(params: {
    imageBase64: string;
    mimeType: string;
    prompt?: string;
    timeoutMs?: number;
    model?: string;
  }): Promise<ImageRecognitionResult> {
    const { imageBase64, mimeType, prompt, timeoutMs, model } = params;
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt ?? DEFAULT_IMAGE_RECOGNITION_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];

    const adapter = this.gateway.getDefaultAdapter();
    const modelName = model ?? (adapter as Record<string, unknown>)?.config?.model ?? 'unknown';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs ?? 120_000);

    try {
      const result = await this.gateway.chat({
        messages,
        temperature: 0.3,
        maxTokens: 8192,
        model,
        signal: controller.signal,
      });

      this.logger.log(`Image recognition completed via ${adapter?.name ?? 'unknown'} (${modelName})`);
      return {
        text: result.content,
        model: modelName,
        adapter: adapter?.name ?? 'unknown',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
