/* 前后端共享的类型写在这里 */

// ==================== 枚举/常量类型 ====================

export type EstimateTaskStatus = 'pending' | 'processing' | 'success' | 'failed';

export type PendingGroupType = 'model_param' | 'retrofit_param' | 'no_data';

export type PendingItemStatus = 'pending' | 'filled' | 'submitted' | 'cancelled';

export type ModelStatus = 'draft' | 'published';

export type LineType = '主线' | '侧围线' | '开闭件线' | '下车体线';

export type UsageScope = '专用' | '通用';

export type ModifyLevel = '新增' | '改造-微' | '改造-小' | '改造-中' | '改造-大';

export type CopyMode = '原创' | '复制' | '镜像';

export type SupplyType = '甲供' | '乙供' | '甲指乙供';

export type PriceCaliber = '未税' | '含税';

export type ContractPreviewStatus = 'valid' | 'invalid';

// ==================== 测算任务模块 ====================

export interface CreateEstimateTaskResponse {
  id: string;
  status: EstimateTaskStatus;
}

export interface EstimateTask {
  id: string;
  file_name: string;
  status: EstimateTaskStatus;
  domain: ArchiveDomain;
  total_rows: number;
  success_rows: number;
  jia_gong_rows: number;
  pending_rows: number;
  main_result_url?: string;
  unknown_result_url?: string;
  anomaly_result?: AnomalyDetectionResult;
  created_at: string;
}

export interface AnomalyDetectionResult {
  risk_level: 'low' | 'medium' | 'high';
  anomaly_count: number;
  anomaly_devices: string;
  anomaly_levels: string;
  overall_assessment: string;
  recommendation: string;
}

export interface EstimateTaskItem {
  id: string;
  device_name: string;
  line_type: LineType;
  quantity: number;
  unit: string;
  usage_scope: UsageScope;
  supply_type: SupplyType;
  price: number;
  total_price: number;
  source: string;
  match_level: string;
  remark: string;
  status: string;
  // 溯源字段
  trace_tag?: '正常' | '跨线' | '甲供-不计费' | '待人工';
  trace_source?: string;
  trace_detail?: string;
  // 预算清单扩展字段
  workstation_no?: string;
  workstation_desc?: string;
  brand?: string;
  category?: string;
  distinction?: string;
  copy_mode?: CopyMode;
  spec_remark?: string;
}

export interface EstimateTaskItemListResponse {
  items: EstimateTaskItem[];
  total: number;
}

export type EstimateItemFilter = 'all' | 'success' | 'jia_gong' | 'pending';

// ==================== 待处理项模块 ====================

export interface PendingItemParam {
  name: string;
  type: string;
  required: boolean;
  value?: string | number;
}

 export interface PendingItem {
   id: string;
   task_id: string;
   group_type: PendingGroupType;
   model_id?: string;
   device_name: string;
   line_type: LineType;
   params: PendingItemParam[];
   filled_values: Record<string, string | number>;
   spec_remark?: string;
   status: PendingItemStatus;
 }

export interface PendingGroup {
  type: PendingGroupType;
  count: number;
}

export interface PendingGroupsResponse {
  groups: PendingGroup[];
}

export interface PendingItemListResponse {
  items: PendingItem[];
  total: number;
}

export interface BatchApplyRequest {
  taskId: string;
  itemIds: string[];
  params: Record<string, string | number>;
}

export interface BatchApplyResponse {
  success: boolean;
}

export interface SubmitPendingItem {
  id: string;
  params: Record<string, string | number>;
  manual_price?: number;
}

export interface SubmitPendingRequest {
  taskId: string;
  items: SubmitPendingItem[];
}

export interface SubmitPendingResponse {
  success: boolean;
  main_result_url: string;
  unknown_result_url: string;
}

export interface ApplyModelRequest {
  taskId: string;
  itemIds: string[];
  modelId: string;
  paramValues?: Record<string, string | number>;
}

export interface ApplyModelResponse {
  success: boolean;
  appliedCount: number;
}

// ==================== 合同归档模块 ====================

export interface ContractParseResponse {
  previewId: string;
  totalCount: number;
  validCount: number;
  invalidCount: number;
}

export interface ContractPreviewItem {
  id: string;
  source_file?: string;
  project: string;
  line_type: LineType;
  device_material_name: string;
  usage_scope?: UsageScope;
  category?: string;
  distinction?: ModifyLevel;
  copy_mode?: CopyMode;
  unit_price: number;
  price_caliber: PriceCaliber;
  supply?: SupplyType;
  unit?: string;
  settle_date: string;
  status: ContractPreviewStatus;
  invalidReason?: string;
  quantity?: number;
  selected_brand?: string;
  subtotal?: number;
  remark?: string;
  workstation_no?: string;
  workstation_desc?: string;
}

export interface ContractPreviewResponse {
  items: ContractPreviewItem[];
  total: number;
}

export type ArchiveDomain = 'welding' | 'manufacturing' | 'painting' | 'stamping';

export const ARCHIVE_DOMAIN_VALUES: ArchiveDomain[] = ['welding', 'manufacturing', 'painting', 'stamping'];

export const ARCHIVE_DOMAIN_LABELS: Record<ArchiveDomain, string> = {
  welding: '焊装',
  manufacturing: '总装费用',
  painting: '涂装费用',
  stamping: '冲压费用',
};

export interface ContractArchiveRequest {
  previewId: string;
  itemIds: string[];
  projectName?: string;
  settleDate?: string;
  lineType?: string;
  projectTime?: string;
  factoryName?: string;
}

export interface ContractArchiveResponse {
  success: boolean;
  archivedCount: number;
  batchId?: string;
  batchName?: string;
}

export interface ArchiveProjectSummary {
  project: string;
  count: number;
  latestArchiveTime: string;
  earliestArchiveTime: string;
  projectTime?: string;
  factoryName?: string;
}

export interface ArchiveProjectInfoUpdateRequest {
  project: string;
  domain?: ArchiveDomain;
  /** undefined = 不修改；空字符串 = 清空 */
  projectTime?: string;
  factoryName?: string;
}

export interface ArchiveProjectInfoUpdateResponse {
  success: boolean;
  updatedCount: number;
}

export type ContractReviewStatus = 'pending_review' | 'approved' | 'rejected';

export interface ContractReviewBatch {
  batchId: string;
  batchName: string;
  count: number;
  submitter: string;
  submitTime: string;
  status: ContractReviewStatus;
  lineType?: string;
  domain?: ArchiveDomain;
}

export interface ContractReviewListResponse {
  batches: ContractReviewBatch[];
}

export interface ContractReviewDetailItem {
  id: string;
  project: string;
  line_type: LineType;
  device_material_name: string;
  usage_scope?: UsageScope;
  category?: string;
  distinction?: ModifyLevel;
  copy_mode?: CopyMode;
  unit_price: number;
  price_caliber: PriceCaliber;
  supply?: SupplyType;
  unit?: string;
  settle_date: string;
  quantity?: number;
  selected_brand?: string;
  subtotal?: number;
  remark?: string;
  workstation_no?: string;
  workstation_desc?: string;
  specification?: string;
  status: ContractReviewStatus;
}

export interface ContractReviewDetailResponse {
  items: ContractReviewDetailItem[];
  total: number;
}

export interface ContractReviewActionRequest {
  batchId: string;
  remark?: string;
  domain?: ArchiveDomain;
}

export interface ContractReviewActionResponse {
  success: boolean;
  affectedCount: number;
}

export interface ContractClearRejectedResponse {
  success: boolean;
  deletedCount: number;
  clearedBatches: number;
}

export interface ContractArchiveLog {
  operator: string;
  operate_time: string;
  count: number;
  batchId?: string;
  batchName?: string;
}

export interface ContractArchiveLogsResponse {
  logs: ContractArchiveLog[];
}

// ==================== 模型管理模块 ====================

export interface ModelInputVar {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string | number;
}

export interface ModelItem {
  id: string;
  model_id: string;
  model_name: string;
  applicable_type: string;
  input_vars: ModelInputVar[];
  formula_logic: string;
  constants: Record<string, string | number>;
  constants_version: string;
  maintainer: string;
  status: ModelStatus;
  updated_at: string;
}

export interface ModelListResponse {
  items: ModelItem[];
  total: number;
}

export interface SaveModelRequest {
  id?: string;
  model_name: string;
  applicable_type: string;
  input_vars: ModelInputVar[];
  formula_logic: string;
  constants: Record<string, string | number>;
}

export interface SaveModelResponse {
  id: string;
  success: boolean;
}

export interface TryoutRequest {
  params: Record<string, string | number>;
}

export interface TryoutResponse {
  success: boolean;
  result?: number;
  error?: string;
}

export interface PublishModelResponse {
  success: boolean;
  version: string;
}

export interface ModelVersion {
  version: string;
  operator: string;
  operate_time: string;
  change_log: string;
}

export interface ModelVersionsResponse {
  items: ModelVersion[];
  total: number;
}

// ==================== 请求类型补充 ====================

export interface EstimateTaskRow {
  device_name: string;
  line_type: LineType;
  quantity: number;
  unit: string;
  usage_scope: UsageScope;
  supply_type: SupplyType;
  modify_level: ModifyLevel;
  copy_mode: CopyMode;
  device_type?: string;
  workstation_no?: string;
  workstation_desc?: string;
  brand?: string;
  category?: string;
  distinction?: string;
  spec_remark?: string;
}

export type EstimateMode = 'standard' | 'budget' | 'project_match';

export interface CreateEstimateTaskRequest {
  file_name: string;
  line_type: LineType;
  domain?: ArchiveDomain;
  estimate_mode?: EstimateMode;
  target_projects?: string[];
  rows: EstimateTaskRow[];
}

export interface ContractRow {
  project: string;
  line_type: LineType;
  device_material_name: string;
  usage_scope?: UsageScope;
  category?: string;
  distinction?: ModifyLevel;
  copy_mode?: CopyMode;
  unit_price: number;
  price_caliber: PriceCaliber;
  supply?: SupplyType;
  unit?: string;
  settle_date: string;
  quantity?: number;
  selected_brand?: string;
  subtotal?: number;
  remark?: string;
  workstation_no?: string;
  workstation_desc?: string;
}

export interface ManufacturingContractRow {
  project: string;
  device_material_name: string;
  specification?: string;
  unit_price: number;
  price_caliber: PriceCaliber;
  unit?: string;
  settle_date: string;
  quantity?: number;
  selected_brand?: string;
  subtotal?: number;
  remark?: string;
}

export interface ManufacturingContractPreviewItem {
  id: string;
  source_file?: string;
  project: string;
  device_material_name: string;
  specification?: string;
  unit_price: number;
  price_caliber: PriceCaliber;
  unit?: string;
  settle_date: string;
  status: ContractPreviewStatus;
  invalidReason?: string;
  quantity?: number;
  selected_brand?: string;
  subtotal?: number;
  remark?: string;
}

export interface ManufacturingContractPreviewResponse {
  items: ManufacturingContractPreviewItem[];
  total: number;
}

export type ContractRowUnion = ContractRow | ManufacturingContractRow;
export type ContractPreviewItemUnion = ContractPreviewItem | ManufacturingContractPreviewItem;
export type ContractPreviewResponseUnion = ContractPreviewResponse | ManufacturingContractPreviewResponse;

export interface ContractProjectsResponse {
  projects: string[];
}

export interface ExtractPdfContractsRequest {
  file_path: string;
  line_type: LineType;
  domain?: ArchiveDomain;
}

export interface ExtractPdfContractsResponse {
  rows: ContractRowUnion[];
}

export interface PdfUploadInitRequest {
  file_name: string;
  file_size: number;
  total_chunks: number;
  file_type?: 'pdf' | 'image';
}

export interface PdfUploadInitResponse {
  session_id: string;
}

export interface PdfUploadChunkRequest {
  session_id: string;
  index: number;
  data: string;
}

export interface PdfUploadChunkResponse {
  received: number;
}

export interface PdfUploadCompleteRequest {
  session_id: string;
  line_type?: LineType;
  domain?: ArchiveDomain;
}

export interface PdfUploadCompleteResponse {
  task_id: string;
}

export interface PdfExtractionProgress {
  done: number;
  total: number;
}

export interface PdfExtractionStatusResponse {
  task_id: string;
  status: 'parsing' | 'extracting' | 'completed' | 'failed';
  progress?: PdfExtractionProgress;
  rows?: ContractRowUnion[];
  error_message?: string;
}

export interface ParseContractRequest {
  file_name: string;
  rows: ContractRowUnion[];
  domain?: ArchiveDomain;
}

// ==================== Agent 模块 ====================

export type AgentSessionStatus = 'active' | 'completed' | 'archived';

export type AgentMessageRole = 'user' | 'agent' | 'system';

export type AgentMessageType =
  | 'text'
  | 'file_upload'
  | 'device_match'
  | 'param_extract'
  | 'anomaly_check'
  | 'summary'
  | 'agent_steps';

export type AgentStepType = 'thinking' | 'tool_call' | 'tool_result' | 'answer';

export interface AgentStep {
  type: AgentStepType;
  content: string;
  tool_name?: string;
  tool_parameters?: Record<string, unknown>;
  tool_result?: unknown;
}

export type AgentMessageStatus = 'sent' | 'confirmed' | 'rejected';

export interface AgentSessionContext {
  task_id?: string;
  total_rows?: number;
  matched_rows?: number;
  pending_rows?: number;
  current_step?: string;
  file_name?: string;
  line_type?: string;
  last_query?: string;
}

export interface AgentTaskStatusResponse {
  status: 'processing' | 'success' | 'failed' | 'no_task';
  task_id?: string;
  total_rows?: number;
  message?: string;
  agent_message?: AgentMessage;
}

export interface AgentSession {
  id: string;
  title: string;
  status: AgentSessionStatus;
  task_id?: string;
  context?: AgentSessionContext;
  created_at: string;
}

export interface DeviceMatchItem {
  pending_item_id: string;
  device_name: string;
  matched_model_id: string;
  matched_model_name: string;
  confidence: number;
  match_reason: string;
  alternative_model_id: string;
  alternative_model_name: string;
}

export interface ParamExtractItem {
  pending_item_id: string;
  device_name: string;
  params: Record<string, string | number>;
}

export interface AnomalyItem {
  device_name: string;
  calculated_price: number;
  historical_avg: number;
  deviation: number;
  level: 'normal' | 'warning' | 'critical';
}

export interface AgentMessageMetadata {
  devices?: DeviceMatchItem[];
  params?: ParamExtractItem[];
  anomalies?: AnomalyItem[];
  file_name?: string;
  task_id?: string;
  stats?: { total: number; matched: number; pending: number };
  line_type?: string;
  prices?: Array<{ device_name: string; price: number }>;
  risk_level?: string;
  recommendation?: string;
  overall_assessment?: string;
  agent_steps?: AgentStep[];
}

export interface AgentMessage {
  id: string;
  session_id: string;
  role: AgentMessageRole;
  content?: string;
  message_type: AgentMessageType;
  metadata?: AgentMessageMetadata;
  status: AgentMessageStatus;
  created_at: string;
}

export interface CreateAgentSessionRequest {
  title?: string;
}

export interface CreateAgentSessionResponse {
  id: string;
  title: string;
  status: AgentSessionStatus;
  created_at: string;
}

export interface AgentSessionListResponse {
  items: AgentSession[];
  total: number;
}

export interface AgentSessionDetailResponse {
  session: AgentSession;
  messages: AgentMessage[];
}

export interface SendAgentMessageRequest {
  content: string;
  role?: AgentMessageRole;
  message_type?: AgentMessageType;
  metadata?: AgentMessageMetadata;
  rows?: EstimateTaskRow[];
}

export interface SendAgentMessageResponse {
  message: AgentMessage;
  agentMessage?: AgentMessage;
}

export interface AgentActionResponse {
  success: boolean;
  agentMessage?: AgentMessage;
}

export interface AgentContextResponse {
  context: string;
}

export interface AgentChatRequest {
  content: string;
}

export interface AgentChatResponse {
  message: AgentMessage;
  agentMessage: AgentMessage;
}

// ==================== 历史价格快查模块 ====================

export type PriceQueryLineType = '全部' | '主线' | '侧围线' | '开闭件线' | '下车体线';
export type PriceQueryUsageScope = '不限' | '专用' | '通用';
export type PriceQueryDeviceType = '不限' | '机器人' | '夹具' | '输送设备' | '焊接设备' | '其他';
export type PriceQuerySupplyType = '不限' | '甲供' | '乙供' | '甲指乙供';
export type ArchivePeriod = 'recent' | 'history';

export interface PriceQueryParams {
  device_material_name?: string;
  project?: string;
  line_type?: PriceQueryLineType;
  usage_scope?: PriceQueryUsageScope;
  category?: PriceQueryDeviceType;
  supply?: PriceQuerySupplyType;
  settle_date_from?: string;
  settle_date_to?: string;
  archive_period?: ArchivePeriod;
  domain?: ArchiveDomain;
}

export interface ArchiveCounts {
  recent: number;
  history: number;
}

export interface PriceQueryRecord {
  id: string;
  project: string;
  line_type: LineType;
  device_material_name: string;
  supply: SupplyType;
  unit_price: number;
  price_caliber: PriceCaliber;
  settle_date: string;
  category?: string;
  selected_brand?: string;
  workstation_no?: string;
  workstation_desc?: string;
}

export interface PriceQueryResponse {
  items: PriceQueryRecord[];
  total: number;
  reference_price?: number;
  reference_count?: number;
  reference_note?: string;
  cross_line_price?: number;
  cross_line_type?: string;
  cross_line_count?: number;
  cross_line_note?: string;
}

export interface PriceQueryStats {
  avg_price: number;
  min_price: number;
  max_price: number;
  count: number;
  line_type: string;
}

// ==================== 角色管理模块 ====================

export interface UserSimpleDTO {
  userID: string;
  name: I18nTextLike;
  avatar?: string;
  userId?: string;
  userName?: string;
  [key: string]: any;
}

export interface DepartmentDTO {
  id: string;
  name: I18nTextLike;
  departmentId?: string;
  departmentName?: string;
  [key: string]: any;
}

export interface ChatSimpleDTO {
  chatID: string;
  name: I18nTextLike;
  avatar?: string;
  chatId?: string;
  chatName?: string;
  [key: string]: any;
}

export interface PresetGroupDTO {
  groupId: string;
  groupName: string;
}

export interface ForceRoleDTO {
  bizID: string;
  name: string;
  description?: string;
  roleMembers?: {
    userList?: RoleMemberDTO[];
    departmentList?: any[];
    groupChatList?: any[];
    allEmployees?: any;
    public?: any;
    presetGroup?: any;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface RoleMemberDTO {
  userID: string;
  userId?: string;
  name?: string;
  userName?: string;
  type: string;
  avatar?: string;
  department?: string;
  [key: string]: any;
}

export interface MemberMutationData {
  members?: Array<{ userId?: string; userID?: string; userName?: string; name?: string }>;
  userList?: Array<{ userId?: string; userID?: string; userName?: string; name?: string }>;
  [key: string]: any;
}

export type MemberType = string;

export interface SearchResponse {
  items: SearchResult[];
  total: number;
}

export interface SearchResult {
  userId: string;
  userName: string;
  department?: string;
  avatar?: string;
}

export interface FilterParams {
  keyword?: string;
  type?: string;
}

export interface I18nText {
  zh_CN?: string;
  zh_cn?: string;
  en_US?: string;
  en_us?: string;
  [key: string]: any;
}

export type I18nTextLike = string | I18nText;

export interface CreateRoleRequest {
  role: { name: string; description?: string; bizID: string };
}

export interface UpdateRoleRequest {
  role: { name?: string; description?: string };
}

export interface AddMembersRequest {
  members: MemberMutationData;
}

export interface RemoveMembersRequest {
  members: MemberMutationData;
}

export interface SearchMembersRequest {
  query: string;
  filters?: FilterParams;
  pageSize?: number;
  page?: number;
}

// ==================== 权限管理模块 ====================

export interface PermissionPoint {
  id: string;
  action: string;
  subject: string;
  description: string;
}

export interface RolePermissionMapping {
  id: string;
  roleKey: string;
  permissionId: string;
}

export interface BatchUpdateRoleMappingsRequest {
  roleKey: string;
  add: string[];
  remove: string[];
}
