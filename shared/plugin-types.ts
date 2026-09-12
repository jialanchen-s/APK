// ---- plugin:welding_cost_anomaly_detection_1 ----
// ============================================================
// 插件 welding_cost_anomaly_detection_1 (焊装费用异常检测) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WeldingCostAnomalyDetectionOneInput {
  /** 测算结果与历史合同数据的对比文本，包含设备名称、测算单价、历史均价、偏离百分比等信息 */
  comparison_text: string;
}

/**
 * capabilityClient.load('welding_cost_anomaly_detection_1').call<WeldingCostAnomalyDetectionOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { risk_level, anomaly_count, anomaly_devices, ... } = result;
 * 返回值形如：
 *   {"risk_level":"示例文本","anomaly_count":0,"anomaly_devices":"示例文本","anomaly_levels":"示例文本","overall_assessment":"示例文本","recommendation":"示例文本"}
 */
export interface WeldingCostAnomalyDetectionOneOutput {
  /** 整体风险等级，值为low/medium/high，根据异常数量和严重程度综合判断 */
  risk_level: string;
  /** warning和critical级别的异常项总数量 */
  anomaly_count: number;
  /** 异常设备名称列表，所有warning和critical级别的设备名称，多个用英文逗号分隔 */
  anomaly_devices: string;
  /** 异常等级列表，按设备顺序对应每个设备的异常等级，值为normal/warning/critical，多个用英文逗号分隔 */
  anomaly_levels: string;
  /** 总体评估说明，对本次焊装费用整体偏离情况的综合分析 */
  overall_assessment: string;
  /** 处理建议，针对异常情况给出具体可执行的应对措施 */
  recommendation: string;
}
// ---- end:welding_cost_anomaly_detection_1 ----

// ---- plugin:welding_equipment_intelligent_matching_1 ----
// ============================================================
// 插件 welding_equipment_intelligent_matching_1 (焊装设备与测算模型智能匹配) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WeldingEquipmentIntelligentMatchingOneInput {
  /** 可用测算模型列表JSON数组字符串，含模型ID和名称 */
  available_models: string;
  /** 设备规格描述文本（可选） */
  spec_description?: string;
  /** 需要匹配的焊装设备名称 */
  device_name: string;
}

/**
 * capabilityClient.load('welding_equipment_intelligent_matching_1').call<WeldingEquipmentIntelligentMatchingOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { alternative_model_id, alternative_model_name, matched_model_id, ... } = result;
 * 返回值形如：
 *   {"alternative_model_id":"示例文本","alternative_model_name":"示例文本","matched_model_id":"示例文本","matched_model_name":"示例文本","confidence":0,"match_reason":"示例文本"}
 */
export interface WeldingEquipmentIntelligentMatchingOneOutput {
  /** 备选模型ID，无不匹配为空字符串 */
  alternative_model_id: string;
  /** 备选模型名称 */
  alternative_model_name: string;
  /** 匹配的模型ID，无匹配为空字符串 */
  matched_model_id: string;
  /** 匹配的模型名称 */
  matched_model_name: string;
  /** 匹配置信度，范围0-100的整数 */
  confidence: number;
  /** 匹配原因说明，简要描述匹配依据 */
  match_reason: string;
}
// ---- end:welding_equipment_intelligent_matching_1 ----

// ---- plugin:welding_cost_calculation_chat_assistant_1 ----
// ============================================================
// 插件 welding_cost_calculation_chat_assistant_1 (焊装费用测算智能对话助手) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WeldingCostCalculationChatAssistantOneInput {
  /** 用户提出的关于焊装费用测算的问题 */
  user_question: string;
  /** 系统上下文，包含系统提示词、对话历史、工具观察结果和业务数据 */
  system_context: string;
}

/**
 * capabilityClient.load('welding_cost_calculation_chat_assistant_1').callStream<WeldingCostCalculationChatAssistantOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 WeldingCostCalculationChatAssistantOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface WeldingCostCalculationChatAssistantOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  response?: string;
}
// ---- end:welding_cost_calculation_chat_assistant_1 ----

// ---- plugin:welding_equipment_param_extract_1 ----
// ============================================================
// 插件 welding_equipment_param_extract_1 (焊装设备参数提取) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WeldingEquipmentParamExtractOneInput {
  /** 焊装设备的规格描述文本、技术参数说明或非结构化文本内容 */
  equipment_text: string;
}

/**
 * capabilityClient.load('welding_equipment_param_extract_1').call<WeldingEquipmentParamExtractOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { material, current, power, ... } = result;
 * 返回值形如：
 *   {"material":"示例文本","current":0,"power":0,"voltage":0,"workpiece_thickness":0,"cycle_time":0,"quantity":0,"electrode_diameter":0,"frequency":0,"welding_type":"示例文本","model_spec":"示例文本","weight":0,"other_params":"示例文本","size":"示例文本","pressure":0,"brand":"示例文本"}
 */
export interface WeldingEquipmentParamExtractOneOutput {
  /** 设备主要材质，未提取到则为null */
  material: string;
  /** 工作电流，单位A，未提取到则为null */
  current: number;
  /** 设备功率，单位kW，未提取到则为null */
  power: number;
  /** 工作电压，单位V，未提取到则为null */
  voltage: number;
  /** 适用工件厚度，单位mm，未提取到则为null */
  workpiece_thickness: number;
  /** 工作节拍时间，单位s，未提取到则为null */
  cycle_time: number;
  /** 设备数量，未提取到则为null */
  quantity: number;
  /** 电极直径，单位mm，未提取到则为null */
  electrode_diameter: number;
  /** 工作频率，单位Hz，未提取到则为null */
  frequency: number;
  /** 焊接类型，未提取到则为null */
  welding_type: string;
  /** 设备型号规格，未提取到则为null */
  model_spec: string;
  /** 设备重量，单位kg，未提取到则为null */
  weight: number;
  /** 其他未包含参数描述，未提取到则为null */
  other_params: string;
  /** 设备尺寸规格，未提取到则为null */
  size: string;
  /** 工作压力，单位kg或kN，未提取到则为null */
  pressure: number;
  /** 设备品牌，未提取到则为null */
  brand: string;
}
// ---- end:welding_equipment_param_extract_1 ----

// ---- plugin:file_parse_text_1 ----
// ============================================================
// 插件 file_parse_text_1 (文档解析为Markdown文本) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface FileParseTextOneInput {
  /** 待解析的文件数组 */
  fileUrl: string[];
}

/**
 * capabilityClient.load('file_parse_text_1').call<FileParseTextOneOutput>('parseDocToMarkdown', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { content } = result;
 * 返回值形如：
 *   {"content":"示例文本"}
 */
export interface FileParseTextOneOutput {
  /** [object Object] */
  content: string;
}
// ---- end:file_parse_text_1 ----

// ---- plugin:welding_equipment_param_extraction_1 ----
// ============================================================
// 插件 welding_equipment_param_extraction_1 (焊装设备参数提取) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WeldingEquipmentParamExtractionOneInput {
  /** 参数的业务含义说明（可选） */
  description?: string;
  /** 焊装设备名称或包含设备描述的文本 */
  device_name: string;
  /** 要提取的参数名称 */
  param_name: string;
  /** 参数类型，值为string或number */
  param_type: string;
}

/**
 * capabilityClient.load('welding_equipment_param_extraction_1').call<WeldingEquipmentParamExtractionOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { value } = result;
 * 返回值形如：
 *   {"value":"示例文本"}
 */
export interface WeldingEquipmentParamExtractionOneOutput {
  /** 从文本中提取到的参数值；param_type为number时输出数字字符串；提取不到时输出空字符串 */
  value: string;
}
// ---- end:welding_equipment_param_extraction_1 ----

// ---- plugin:image_content_intelligent_recognition_1 ----
// ============================================================
// 插件 image_content_intelligent_recognition_1 (图片内容智能识别) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface ImageContentIntelligentRecognitionOneInput {
  /** 最大令牌数，控制生成文本的长度 */
  maxTokens?: string;
  /** 图片内容识别提示词 */
  prompt: string;
  /** 待识别的图片数组 */
  images: string[];
  /** 模型ID */
  modelID?: string;
  /** 温度参数，控制生成文本的随机性 */
  temperature?: string;
}

/**
 * capabilityClient.load('image_content_intelligent_recognition_1').callStream<ImageContentIntelligentRecognitionOneOutput>('imageUnderstanding', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 ImageContentIntelligentRecognitionOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","reasoningContent":"","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface ImageContentIntelligentRecognitionOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  reasoningContent?: string;
  /** [object Object] */
  response?: string;
}
// ---- end:image_content_intelligent_recognition_1 ----

// ---- plugin:contract_detail_extract_1 ----
// ============================================================
// 插件 contract_detail_extract_1 (合同文本结构化提取) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface ContractDetailExtractOneInput {
  /** 从PDF合同解析出的Markdown文本内容 */
  contract_text: string;
}

/**
 * capabilityClient.load('contract_detail_extract_1').call<ContractDetailExtractOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { rowsJson } = result;
 * 返回值形如：
 *   {"rowsJson":"示例文本"}
 */
export interface ContractDetailExtractOneOutput {
  /** 合同明细行 JSON 数组字符串：每个元素包含 project、device_material_name(必填)、category、distinction、copy_mode、usage_scope、unit_price、price_caliber、unit、quantity、subtotal、supply、selected_brand、settle_date、workstation_no、workstation_desc、remark 键。未提及的字符串字段填空字符串、数值字段填 0，禁止 null；整体必须是合法 JSON 数组字符串（以[开头、]结尾）。 */
  rowsJson: string;
}
// ---- end:contract_detail_extract_1 ----

// ---- plugin:manufacturing_contract_detail_extract_1 ----
// ============================================================
// 插件 manufacturing_contract_detail_extract_1 (制造费用合同文本结构化提取) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface ManufacturingContractDetailExtractOneInput {
  /** 制造费用合同解析后的Markdown文本内容 */
  contract_content: string;
}

/**
 * capabilityClient.load('manufacturing_contract_detail_extract_1').call<ManufacturingContractDetailExtractOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { rowsJson } = result;
 * 返回值形如：
 *   {"rowsJson":[]}
 */
export interface ManufacturingContractDetailExtractOneOutput {
  /** 设备/费用明细列表，items schema: {project: string(项目/工程名称), device_material_name: string(设备名称或费用项目名称，必填), specification: string(规格型号/技术参数), unit_price: number(单价（元）), price_caliber: string(价格口径（含税/未税，默认未税）), unit: string(单位（如 台、套、项、个）), quantity: number(数量), subtotal: number(小计/合价（元）), selected_brand: string(品牌/供应商), settle_date: string(结算日期（YYYY-MM-DD 格式，没有则留空）), remark: string(备注)} */
  rowsJson: unknown[];
}
// ---- end:manufacturing_contract_detail_extract_1 ----