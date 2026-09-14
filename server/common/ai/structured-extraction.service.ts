import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '@server/common/ai/ai-gateway.service';
import type { ChatMessage } from '@server/common/ai/llm-adapter.interface';

const WELDING_EXTRACT_PROMPT = `你是一个合同数据提取专家。从以下焊装合同文本中提取每一行设备/材料明细，输出严格的 JSON 数组。

每个元素必须包含以下键：
- project: 项目/工程名称（字符串，无则空字符串）
- device_material_name: 设备或材料名称（字符串，必填，无则跳过该行）
- category: 类别（字符串，无则空字符串）
- distinction: 改造等级/新增或利旧（字符串，无则空字符串）
- copy_mode: 复制模式（字符串，无则空字符串）
- usage_scope: 使用范围（字符串，无则空字符串）
- unit_price: 单价（数字，无则0）
- price_caliber: 价格口径，值为"含税"或"未税"（字符串，无则空字符串）
- unit: 单位（字符串，无则空字符串）
- quantity: 数量（数字，无则0）
- subtotal: 小计/合价（数字，无则0）
- supply: 供应商类型，甲供或乙供（字符串，无则空字符串）
- selected_brand: 选定品牌（字符串，无则空字符串）
- settle_date: 结算日期，YYYY-MM-DD格式（字符串，无则空字符串）
- workstation_no: 工位编号（字符串，无则空字符串）
- workstation_desc: 工位描述（字符串，无则空字符串）
- remark: 备注（字符串，无则空字符串）

规则：
1. 不要输出 null，字符串字段无值填空字符串""，数值字段无值填0
2. 数值保持原样，不要换算
3. 只输出 JSON 数组，以[开头、]结尾，不要任何解释文字或 markdown 代码块标记`;

const MANUFACTURING_EXTRACT_PROMPT = `你是一个合同数据提取专家。从以下制造费用合同文本中提取每一行设备/费用明细，输出严格的 JSON 数组。

每个元素必须包含以下键：
- project: 项目/工程名称（字符串，无则空字符串）
- device_material_name: 设备名称或费用项目名称（字符串，必填，无则跳过该行）
- specification: 规格型号/技术参数（字符串，无则空字符串）
- unit_price: 单价，单位元（数字，无则0）
- price_caliber: 价格口径，值为"含税"或"未税"，默认"未税"（字符串）
- unit: 单位，如台、套、项、个（字符串，无则空字符串）
- quantity: 数量（数字，无则0）
- subtotal: 小计/合价，单位元（数字，无则0）
- selected_brand: 品牌/供应商（字符串，无则空字符串）
- settle_date: 结算日期，YYYY-MM-DD格式（字符串，无则空字符串）
- remark: 备注（字符串，无则空字符串）

规则：
1. 不要输出 null，字符串字段无值填空字符串""，数值字段无值填0
2. 数值保持原样，不要换算
3. 只输出 JSON 数组，以[开头、]结尾，不要任何解释文字或 markdown 代码块标记`;

export type ExtractionDomain = 'welding' | 'manufacturing';

@Injectable()
export class StructuredExtractionService {
  private readonly logger = new Logger(StructuredExtractionService.name);

  constructor(private readonly gateway: AIGatewayService) {}

  async extractContractRows(text: string, domain: ExtractionDomain = 'welding'): Promise<Record<string, unknown>[]> {
    const prompt = domain === 'welding' ? WELDING_EXTRACT_PROMPT : MANUFACTURING_EXTRACT_PROMPT;

    const messages: ChatMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: text },
    ];

    const result = await this.gateway.chat({
      messages,
      temperature: 0.1,
      maxTokens: 8192,
    });

    const content = result.content.trim();
    return this.parseRowsJson(content);
  }

  private parseRowsJson(content: string): Record<string, unknown>[] {
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    const jsonStr = arrayStart >= 0 && arrayEnd > arrayStart
      ? cleaned.slice(arrayStart, arrayEnd + 1)
      : cleaned;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      this.logger.error(`Extraction JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
      this.logger.debug(`Raw content: ${content.slice(0, 500)}`);
      return [];
    }

    if (!Array.isArray(parsed)) {
      this.logger.warn(`Extraction result is not an array`);
      return [];
    }

    return parsed.filter(
      (item): item is Record<string, unknown> => item !== null && typeof item === 'object',
    );
  }
}
