import type { JsonSchemaField } from './llm-adapter.interface';

export interface TaskDefinition {
  key: string;
  name: string;
  description: string;
  promptTemplate: string;
  inputVariables: string[];
  jsonSchema?: JsonSchemaField[];
  defaults?: {
    temperature?: number;
    maxTokens?: number;
  };
  mode: 'chat' | 'text-to-json';
}

export const TASK_DEFINITIONS: Record<string, TaskDefinition> = {
  welding_equipment_param_extract: {
    key: 'welding_equipment_param_extract',
    name: '焊装设备参数提取',
    description: '从焊装设备的非结构化文本中提取16项技术参数，输出结构化JSON',
    mode: 'text-to-json',
    inputVariables: ['equipment_text'],
    defaults: { temperature: 0.5, maxTokens: 8192 },
    promptTemplate: `你是专业的工业设备参数提取专家，请从以下焊装设备文本中提取所有要求的技术参数：
{{equipment_text}}

提取规则：
1. 数值类参数仅保留数字，不要单位；
2. 确保提取的参数与字段定义完全匹配；
3. 其他未被明确分类的参数统一放入 other_params 字段；
4. 严格按照指定的 JSON 结构输出，不要额外内容；
5. 必须输出全部 16 个字段，文本中未提取到的数值类字段（frequency、workpiece_thickness、cycle_time、voltage、current、quantity、weight、electrode_diameter、power、pressure）必须填数字 0，未提取到的字符串类字段（brand、welding_type、model_spec、other_params、size、material）必须填空字符串，禁止返回 null、禁止省略任何字段。`,
    jsonSchema: [
      { name: 'frequency', type: 'Number', description: '工作频率，单位Hz，未提取到则为 0' },
      { name: 'brand', type: 'String', description: '设备品牌，未提取到则为空字符串' },
      { name: 'welding_type', type: 'String', description: '焊接类型，未提取到则为空字符串' },
      { name: 'workpiece_thickness', type: 'Number', description: '适用工件厚度，单位mm，未提取到则为 0' },
      { name: 'cycle_time', type: 'Number', description: '工作节拍时间，单位s，未提取到则为 0' },
      { name: 'voltage', type: 'Number', description: '工作电压，单位V，未提取到则为 0' },
      { name: 'current', type: 'Number', description: '工作电流，单位A，未提取到则为 0' },
      { name: 'model_spec', type: 'String', description: '设备型号规格，未提取到则为空字符串' },
      { name: 'quantity', type: 'Number', description: '设备数量，未提取到则为 0' },
      { name: 'weight', type: 'Number', description: '设备重量，单位kg，未提取到则为 0' },
      { name: 'other_params', type: 'String', description: '其他未包含参数描述，未提取到则为空字符串' },
      { name: 'size', type: 'String', description: '设备尺寸规格，未提取到则为空字符串' },
      { name: 'material', type: 'String', description: '设备主要材质，未提取到则为空字符串' },
      { name: 'electrode_diameter', type: 'Number', description: '电极直径，单位mm，未提取到则为 0' },
      { name: 'power', type: 'Number', description: '设备功率，单位kW，未提取到则为 0' },
      { name: 'pressure', type: 'Number', description: '工作压力，单位kg或kN，未提取到则为 0' },
    ],
  },

  welding_equipment_param_extraction: {
    key: 'welding_equipment_param_extraction',
    name: '焊装设备单参数提取',
    description: '从设备文本中提取单个指定参数的值（按 param_name）',
    mode: 'text-to-json',
    inputVariables: ['device_name', 'param_name', 'param_type', 'description'],
    defaults: { temperature: 0.5, maxTokens: 8192 },
    promptTemplate: `你是专业的焊装设备参数提取专家，请从以下设备文本中提取指定参数的值。

设备文本：{{device_name}}
要提取的参数名称：{{param_name}}
参数类型：{{param_type}}
参数业务含义：{{description}}

提取规则：
1. 严格从给定的设备文本中提取参数值，不得编造信息
2. 如果参数类型为number，请提取数字部分并返回字符串格式，例如提取到"150KW"则返回"150"
3. 如果文本中不存在该参数，返回空字符串
4. 不要添加任何额外说明，只返回提取到的参数值本身`,
    jsonSchema: [
      { name: 'value', type: 'String', description: '从文本中提取到的参数值；param_type为number时输出数字字符串；提取不到时输出空字符串' },
    ],
  },

  welding_cost_anomaly_detection: {
    key: 'welding_cost_anomaly_detection',
    name: '焊装费用异常检测',
    description: '对焊装费用测算结果与历史合同数据的对比文本进行异常检测分析',
    mode: 'text-to-json',
    inputVariables: ['comparison_text'],
    defaults: { temperature: 0.5, maxTokens: 8192 },
    promptTemplate: `你是一位专业的工业制造费用分析专家，擅长从焊装费用对比数据中识别异常情况并提供专业评估。

请对以下焊装费用测算结果与历史合同数据的对比文本进行异常检测分析：
{{comparison_text}}

分析要求：
1. 识别所有设备的单价偏离情况，根据偏离百分比判断异常等级：
   - 偏离≤5%：normal（正常）
   - 5%<偏离≤15%：warning（警告）
   - 偏离>15%：critical（严重）
2. 统计所有异常设备信息并按要求输出对应字段
3. 评估说明需客观准确，处理建议需具备可操作性
4. 必须输出全部 6 个字段（anomaly_levels、overall_assessment、recommendation、risk_level、anomaly_count、anomaly_devices），任何字段都禁止返回 null 或省略：没有检测到异常时 anomaly_levels 填 normal、anomaly_count 填 0、anomaly_devices 填空字符串、risk_level 按整体情况填 low/medium/high，文本信息不足时 overall_assessment 和 recommendation 填写基于输入文本的合理说明`,
    jsonSchema: [
      { name: 'anomaly_levels', type: 'String', description: '异常等级列表，按设备顺序对应每个设备的异常等级，值为normal/warning/critical，多个用英文逗号分隔' },
      { name: 'overall_assessment', type: 'String', description: '总体评估说明，对本次焊装费用整体偏离情况的综合分析' },
      { name: 'recommendation', type: 'String', description: '处理建议，针对异常情况给出具体可执行的应对措施' },
      { name: 'risk_level', type: 'String', description: '整体风险等级，值为low/medium/high' },
      { name: 'anomaly_count', type: 'Number', description: 'warning和critical级别的异常项总数量' },
      { name: 'anomaly_devices', type: 'String', description: '异常设备名称列表，所有warning和critical级别的设备名称，多个用英文逗号分隔' },
    ],
  },

  welding_cost_calculation_chat_assistant: {
    key: 'welding_cost_calculation_chat_assistant',
    name: '焊装费用测算智能对话助手',
    description: 'Agent 的 LLM 大脑，根据系统上下文和用户问题生成回答',
    mode: 'chat',
    inputVariables: ['user_question', 'system_context'],
    defaults: { temperature: 0.5, maxTokens: 8192 },
    promptTemplate: `你是一位专业的焊装费用测算智能助手，精通汽车制造焊装工艺成本核算、材料定价、工时计算、设备折旧等相关领域知识。请基于以下系统上下文信息，准确回答用户的问题。

系统上下文：
{{system_context}}

用户问题：
{{user_question}}

回答要求：
1. 严格基于提供的上下文信息回答，不得编造或猜测上下文以外的信息
2. 回答需准确、专业、清晰，符合焊装行业的专业术语规范
3. 如果上下文信息不足以回答问题，请明确说明缺少的信息并告知用户需要补充哪些内容
4. 对于涉及金额、参数等数值的内容，确保计算准确，单位清晰
5. 回答结构清晰，重点突出，便于用户理解
6. 若系统上下文中规定了输出格式（例如 ReAct JSON 格式，含 thought/action/parameters/answer 字段），必须严格输出合法的 JSON：字符串内部的换行必须转义为反斜杠n、双引号必须转义为反斜杠双引号，禁止在字符串值中出现裸换行，禁止在 JSON 前后添加任何解释文字或 markdown 代码块标记，保证整体内容可被 JSON.parse 直接解析`,
  },

  welding_equipment_intelligent_matching: {
    key: 'welding_equipment_intelligent_matching',
    name: '焊装设备与测算模型智能匹配',
    description: '根据设备信息和可用模型列表，智能匹配最合适的测算模型',
    mode: 'text-to-json',
    inputVariables: ['device_name', 'available_models', 'spec_description'],
    defaults: { temperature: 0.5, maxTokens: 8192 },
    promptTemplate: `你是一位焊装设备与测算模型匹配专家，具备丰富的焊装工艺知识和模型匹配经验。

请根据以下信息完成焊装设备与测算模型的智能匹配：

焊装设备名称：{{device_name}}
可用测算模型列表：{{available_models}}
设备规格描述：{{spec_description}}

匹配规则：
1. 优先根据设备名称与模型名称的语义相似度进行匹配
2. 结合设备规格描述进一步确认匹配准确性
3. 置信度评分标准：
   - 90-100：完全匹配，设备名称与模型名称高度相关，规格描述完全符合
   - 70-89：高度匹配，设备名称与模型名称相关性强，规格描述基本符合
   - 50-69：一般匹配，设备名称与模型名称有一定相关性，规格描述部分符合
   - 0-49：不匹配，无相关模型
4. 当存在多个高匹配度模型时，选择置信度最高的作为主匹配模型，次高的作为备选模型
5. 若无匹配模型，matched_model_id和matched_model_name填空字符串，confidence填0
6. 必须输出全部 6 个字段（matched_model_id、matched_model_name、confidence、match_reason、alternative_model_id、alternative_model_name），任何字段都禁止返回 null 或省略：没有找到匹配模型时 matched_model_id 和 matched_model_name 填空字符串、confidence 填 0、match_reason 填无法匹配的原因说明，没有备选模型时 alternative_model_id 和 alternative_model_name 填空字符串

输出要求：
- 严格按照指定的JSON结构输出，不要添加额外字段
- 置信度为整数，范围0-100
- 匹配原因需简洁明了，说明匹配依据`,
    jsonSchema: [
      { name: 'matched_model_id', type: 'String', description: '匹配的模型ID，无匹配为空字符串' },
      { name: 'matched_model_name', type: 'String', description: '匹配的模型名称' },
      { name: 'confidence', type: 'Number', description: '匹配置信度，范围0-100的整数' },
      { name: 'match_reason', type: 'String', description: '匹配原因说明，简要描述匹配依据' },
      { name: 'alternative_model_id', type: 'String', description: '备选模型ID，无不匹配为空字符串' },
      { name: 'alternative_model_name', type: 'String', description: '备选模型名称' },
    ],
  },

  contract_detail_extract: {
    key: 'contract_detail_extract',
    name: '合同文本结构化提取',
    description: '从PDF合同解析出的Markdown文本中提取焊装设备/材料明细行',
    mode: 'text-to-json',
    inputVariables: ['contract_text'],
    defaults: { temperature: 0.5, maxTokens: 8192 },
    promptTemplate: `你是专业的合同数据提取专家。请从以下合同文本中提取所有焊装设备/材料明细行。

合同文本：{{contract_text}}

提取规则：
1. 仅提取与焊装设备、材料相关的明细行，其他类型内容忽略
2. 每个明细行对应一个JSON对象，包含所有要求的字段
3. 文本中未提及的字符串字段填空字符串，数值字段填0，禁止输出null
4. 单价、数量、小计字段必须为数值类型，未提取到填0
5. 结算日期必须为YYYY-MM-DD格式，未提取到填空字符串
6. price_caliber字段默认值为"未税"
7. 最终输出必须是一个合法的JSON数组字符串，以[开头、]结尾

字段说明：project=项目；device_material_name=设备/材料名称(必填)；category=类别/规格；distinction=区分；copy_mode=复制或镜像；usage_scope=通用或专用；unit_price=单价(数值)；price_caliber=含税或未税(默认未税)；unit=单位；quantity=数量(数值)；subtotal=小计(数值)；supply=供货方式；selected_brand=品牌；settle_date=结算日期(YYYY-MM-DD)；workstation_no=工位号；workstation_desc=工位描述；remark=备注。`,
    jsonSchema: [
      { name: 'rowsJson', type: 'String', description: '合同明细行 JSON 数组字符串：每个元素包含 project、device_material_name(必填)、category、distinction、copy_mode、usage_scope、unit_price、price_caliber、unit、quantity、subtotal、supply、selected_brand、settle_date、workstation_no、workstation_desc、remark 键。未提及的字符串字段填空字符串、数值字段填 0，禁止 null；整体必须是合法 JSON 数组字符串（以[开头、]结尾）。' },
    ],
  },

  manufacturing_contract_detail_extract: {
    key: 'manufacturing_contract_detail_extract',
    name: '制造费用合同文本结构化提取',
    description: '从制造费用类PDF合同解析出的Markdown文本中提取设备/费用明细行',
    mode: 'text-to-json',
    inputVariables: ['contract_content'],
    defaults: { temperature: 0.1, maxTokens: 8192 },
    promptTemplate: `你是一位专业的制造行业合同数据提取专家，擅长从制造费用类合同文本中精准提取设备和费用明细信息。

请从以下合同文本里识别所有设备清单、费用清单或报价明细表，按行提取明细数据，每行对应数组的一个元素；如果文本里有多张表，全部提取合并到一个数组；中文列名请严格按照以下对应关系映射：
- 项目/工程名称 → project
- 设备名称/费用项目名称 → device_material_name（必填项，未提取到填空字符串）
- 规格型号/技术参数 → specification
- 单价（元） → unit_price
- 价格口径（含税/未税，默认未税） → price_caliber
- 单位（如台、套、项、个） → unit
- 数量 → quantity
- 小计/合价（元） → subtotal
- 品牌/供应商 → selected_brand
- 结算日期（YYYY-MM-DD格式，没有则留空） → settle_date
- 备注 → remark

合同文本内容：
{{contract_content}}

提取规则：
1. 未提取到的字符串类型字段填空字符串，数字类型字段填0，禁止使用null
2. 整体输出必须是合法JSON数组字符串，以[开头、]结尾
3. 制造费用合同不区分线别，不需要输出line_type字段
4. 严格按照指定字段名称输出，不要添加或减少字段`,
    jsonSchema: [
      { name: 'rowsJson', type: 'Array', description: '设备/费用明细列表，items schema: {project, device_material_name(必填), specification, unit_price, price_caliber(默认未税), unit, quantity, subtotal, selected_brand, settle_date(YYYY-MM-DD), remark}' },
    ],
  },
};

export function renderPrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in variables)) {
      throw new Error(`Prompt variable "${key}" not provided`);
    }
    return variables[key];
  });
}

export function getTaskDefinition(taskKey: string): TaskDefinition {
  const def = TASK_DEFINITIONS[taskKey];
  if (!def) {
    throw new Error(`Unknown task key: ${taskKey}`);
  }
  return def;
}
