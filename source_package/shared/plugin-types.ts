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
 * const { anomaly_levels, overall_assessment, recommendation, ... } = result;
 */
export interface WeldingCostAnomalyDetectionOneOutput {
  /** 对应异常等级列表，与anomaly_devices顺序一致，值为normal/warning/critical，多个用英文逗号分隔 */
  anomaly_levels: string;
  /** 总体评估说明，概括本次对比的整体情况、异常分布特点 */
  overall_assessment: string;
  /** 处理建议，针对异常项给出具体的核查、调整或审批建议 */
  recommendation: string;
  /** 整体风险等级，值为low/medium/high */
  risk_level: string;
  /** 异常项数量，仅统计warning和critical级别的设备数量 */
  anomaly_count: number;
  /** 异常设备名称列表，多个设备用英文逗号分隔 */
  anomaly_devices: string;
}
// ---- end:welding_cost_anomaly_detection_1 ----

// ---- plugin:welding_equipment_intelligent_matching_1 ----
// ============================================================
// 插件 welding_equipment_intelligent_matching_1 (焊装设备智能匹配) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WeldingEquipmentIntelligentMatchingOneInput {
  /** 可选的设备规格描述文本 */
  spec_description?: string;
  /** 可用测算模型列表，格式为JSON数组，包含模型ID和名称等信息 */
  available_models: string;
  /** 需要匹配的焊装设备名称 */
  device_name: string;
}

/**
 * capabilityClient.load('welding_equipment_intelligent_matching_1').call<WeldingEquipmentIntelligentMatchingOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { matched_model_id, matched_model_name, confidence, ... } = result;
 */
export interface WeldingEquipmentIntelligentMatchingOneOutput {
  /** 匹配的模型ID，无匹配则为空字符串 */
  matched_model_id: string;
  /** 匹配的模型名称，无匹配则为空字符串 */
  matched_model_name: string;
  /** 匹配置信度，范围0-100，无匹配则为0 */
  confidence: number;
  /** 匹配原因说明，无匹配则为空字符串 */
  match_reason: string;
  /** 备选模型ID，无备选则为空字符串 */
  alternative_model_id: string;
  /** 备选模型名称，无备选则为空字符串 */
  alternative_model_name: string;
}
// ---- end:welding_equipment_intelligent_matching_1 ----

// ---- plugin:welding_cost_calculation_chat_assistant_1 ----
// ============================================================
// 插件 welding_cost_calculation_chat_assistant_1 (焊装费用核算对话助手) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WeldingCostCalculationChatAssistantOneInput {
  /** 用户提出的关于焊装费用核算的问题或指令 */
  user_question: string;
  /** 系统上下文信息，包括当前测算任务状态、待处理项、历史合同、已有的测算数据等相关信息 */
  system_context: string;
}

/**
 * capabilityClient.load('welding_cost_calculation_chat_assistant_1').call<WeldingCostCalculationChatAssistantOneOutput>('textGenerate', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { content, response } = result;
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
// 插件 welding_equipment_param_extract_1 (焊装设备参数自动提取) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WeldingEquipmentParamExtractOneInput {
  /** 焊装设备的规格描述文本、技术参数说明或非结构化文本内容 */
  equipment_text: string;
}

/**
 * capabilityClient.load('welding_equipment_param_extract_1').call<WeldingEquipmentParamExtractOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { frequency, brand, welding_type, ... } = result;
 */
export interface WeldingEquipmentParamExtractOneOutput {
  /** 工作频率，单位Hz */
  frequency: number;
  /** 设备品牌 */
  brand: string;
  /** 焊接类型 */
  welding_type: string;
  /** 适用工件厚度，单位mm */
  workpiece_thickness: number;
  /** 工作节拍时间，单位s */
  cycle_time: number;
  /** 工作电压，单位V */
  voltage: number;
  /** 工作电流，单位A */
  current: number;
  /** 设备型号规格 */
  model_spec: string;
  /** 设备数量 */
  quantity: number;
  /** 设备重量，单位kg */
  weight: number;
  /** 其他未在上述字段中包含的参数描述 */
  other_params: string;
  /** 设备尺寸规格 */
  size: string;
  /** 设备主要材质 */
  material: string;
  /** 电极直径，单位mm */
  electrode_diameter: number;
  /** 设备功率，单位kW */
  power: number;
  /** 工作压力，单位kg或kN */
  pressure: number;
}
// ---- end:welding_equipment_param_extract_1 ----

// ---- plugin:file_parse_text_1 ----
// ============================================================
// 插件 file_parse_text_1 (文件解析) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface FileParseTextOneInput {
  /** [object Object] */
  fileUrl: string[];
}

/**
 * capabilityClient.load('file_parse_text_1').call<FileParseTextOneOutput>('parseDocToMarkdown', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { content } = result;
 */
export interface FileParseTextOneOutput {
  /** [object Object] */
  content: string;
}
// ---- end:file_parse_text_1 ----