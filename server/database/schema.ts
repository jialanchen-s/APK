/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, foreignKey, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const stampingContract = pgTable("stamping_contract", {
  id: uuid("id").primaryKey().defaultRandom(),
  project: varchar("project", { length: 100 }),
  lineType: varchar("line_type", { length: 50 }),
  deviceMaterialName: varchar("device_material_name", { length: 255 }).notNull(),
  usageScope: varchar("usage_scope", { length: 50 }),
  category: varchar("category", { length: 100 }),
  distinction: varchar("distinction", { length: 50 }),
  copyMode: varchar("copy_mode", { length: 50 }),
  unitPrice: numeric("unit_price"),
  priceCaliber: varchar("price_caliber", { length: 50 }).default('未税'),
  supply: varchar("supply", { length: 50 }),
  unit: varchar("unit", { length: 50 }),
  settleDate: customTimestamptz("settle_date", { precision: 6 }),
  archiveOperator: userProfile("archive_operator"),
  archiveTime: customTimestamptz("archive_time", { precision: 6 }).default(sql`CURRENT_TIMESTAMP`),
  quantity: numeric("quantity"),
  selectedBrand: varchar("selected_brand", { length: 255 }),
  subtotal: numeric("subtotal"),
  remark: text("remark"),
  workstationNo: varchar("workstation_no", { length: 100 }),
  workstationDesc: varchar("workstation_desc", { length: 255 }),
  archiveBatchId: uuid("archive_batch_id"),
  archiveBatchName: varchar("archive_batch_name", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default('pending_review'),
  reviewer: userProfile("reviewer"),
  reviewTime: customTimestamptz("review_time", { precision: 6 }),
  reviewRemark: text("review_remark"),
  specification: varchar("specification", { length: 255 }),
  projectTime: varchar("project_time", { length: 20 }),
  factoryName: varchar("factory_name", { length: 100 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_stamping_contract_line_type").on(table.lineType),
  index("idx_stamping_contract_device_material_name").on(table.deviceMaterialName),
  index("idx_stamping_contract_supply").on(table.supply),
  index("idx_stamping_contract_archive_batch_id").on(table.archiveBatchId),
  index("idx_stamping_contract_status").on(table.status),
]);

export const paintingContract = pgTable("painting_contract", {
  id: uuid("id").primaryKey().defaultRandom(),
  project: varchar("project", { length: 100 }),
  lineType: varchar("line_type", { length: 50 }),
  deviceMaterialName: varchar("device_material_name", { length: 255 }).notNull(),
  usageScope: varchar("usage_scope", { length: 50 }),
  category: varchar("category", { length: 100 }),
  distinction: varchar("distinction", { length: 50 }),
  copyMode: varchar("copy_mode", { length: 50 }),
  unitPrice: numeric("unit_price"),
  priceCaliber: varchar("price_caliber", { length: 50 }).default('未税'),
  supply: varchar("supply", { length: 50 }),
  unit: varchar("unit", { length: 50 }),
  settleDate: customTimestamptz("settle_date", { precision: 6 }),
  archiveOperator: userProfile("archive_operator"),
  archiveTime: customTimestamptz("archive_time", { precision: 6 }).default(sql`CURRENT_TIMESTAMP`),
  quantity: numeric("quantity"),
  selectedBrand: varchar("selected_brand", { length: 255 }),
  subtotal: numeric("subtotal"),
  remark: text("remark"),
  workstationNo: varchar("workstation_no", { length: 100 }),
  workstationDesc: varchar("workstation_desc", { length: 255 }),
  archiveBatchId: uuid("archive_batch_id"),
  archiveBatchName: varchar("archive_batch_name", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default('pending_review'),
  reviewer: userProfile("reviewer"),
  reviewTime: customTimestamptz("review_time", { precision: 6 }),
  reviewRemark: text("review_remark"),
  specification: varchar("specification", { length: 255 }),
  projectTime: varchar("project_time", { length: 20 }),
  factoryName: varchar("factory_name", { length: 100 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_painting_contract_line_type").on(table.lineType),
  index("idx_painting_contract_device_material_name").on(table.deviceMaterialName),
  index("idx_painting_contract_supply").on(table.supply),
  index("idx_painting_contract_archive_batch_id").on(table.archiveBatchId),
  index("idx_painting_contract_status").on(table.status),
]);

export const manufacturingContract = pgTable("manufacturing_contract", {
  id: uuid("id").primaryKey().defaultRandom(),
  project: varchar("project", { length: 100 }),
  lineType: varchar("line_type", { length: 50 }),
  deviceMaterialName: varchar("device_material_name", { length: 255 }).notNull(),
  usageScope: varchar("usage_scope", { length: 50 }),
  category: varchar("category", { length: 100 }),
  distinction: varchar("distinction", { length: 50 }),
  copyMode: varchar("copy_mode", { length: 50 }),
  unitPrice: numeric("unit_price"),
  priceCaliber: varchar("price_caliber", { length: 50 }).default('未税'),
  supply: varchar("supply", { length: 50 }),
  unit: varchar("unit", { length: 50 }),
  settleDate: customTimestamptz("settle_date", { precision: 6 }),
  archiveOperator: userProfile("archive_operator"),
  archiveTime: customTimestamptz("archive_time", { precision: 6 }).default(sql`CURRENT_TIMESTAMP`),
  quantity: numeric("quantity"),
  selectedBrand: varchar("selected_brand", { length: 255 }),
  subtotal: numeric("subtotal"),
  remark: text("remark"),
  workstationNo: varchar("workstation_no", { length: 100 }),
  workstationDesc: varchar("workstation_desc", { length: 255 }),
  archiveBatchId: uuid("archive_batch_id"),
  archiveBatchName: varchar("archive_batch_name", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default('pending_review'),
  reviewer: userProfile("reviewer"),
  reviewTime: customTimestamptz("review_time", { precision: 6 }),
  reviewRemark: text("review_remark"),
  specification: varchar("specification", { length: 255 }),
  projectTime: varchar("project_time", { length: 20 }),
  factoryName: varchar("factory_name", { length: 100 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_manufacturing_contract_line_type").on(table.lineType),
  index("idx_manufacturing_contract_device_material_name").on(table.deviceMaterialName),
  index("idx_manufacturing_contract_supply").on(table.supply),
  index("idx_manufacturing_contract_archive_batch_id").on(table.archiveBatchId),
  index("idx_manufacturing_contract_status").on(table.status),
]);

export const contract = pgTable("contract", {
  id: uuid("id").primaryKey().defaultRandom(),
  project: varchar("project", { length: 100 }),
  lineType: varchar("line_type", { length: 50 }),
  deviceMaterialName: varchar("device_material_name", { length: 255 }).notNull(),
  usageScope: varchar("usage_scope", { length: 50 }),
  category: varchar("category", { length: 100 }),
  distinction: varchar("distinction", { length: 50 }),
  copyMode: varchar("copy_mode", { length: 50 }),
  unitPrice: numeric("unit_price"),
  priceCaliber: varchar("price_caliber", { length: 50 }).default('未税'),
  supply: varchar("supply", { length: 50 }),
  unit: varchar("unit", { length: 50 }),
  settleDate: customTimestamptz("settle_date", { precision: 6 }),
  archiveOperator: userProfile("archive_operator"),
  archiveTime: customTimestamptz("archive_time", { precision: 6 }).default(sql`CURRENT_TIMESTAMP`),
  quantity: numeric("quantity"),
  selectedBrand: varchar("selected_brand", { length: 255 }),
  subtotal: numeric("subtotal"),
  remark: text("remark"),
  workstationNo: varchar("workstation_no", { length: 100 }),
  workstationDesc: varchar("workstation_desc", { length: 255 }),
  archiveBatchId: uuid("archive_batch_id"),
  archiveBatchName: varchar("archive_batch_name", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default('pending_review'),
  reviewer: userProfile("reviewer"),
  reviewTime: customTimestamptz("review_time", { precision: 6 }),
  reviewRemark: text("review_remark"),
  projectTime: varchar("project_time", { length: 20 }),
  factoryName: varchar("factory_name", { length: 100 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_contract_line_type").on(table.lineType),
  index("idx_contract_device_material_name").on(table.deviceMaterialName),
  index("idx_contract_supply").on(table.supply),
  index("idx_contract_archive_batch_id").on(table.archiveBatchId),
  index("idx_contract_status").on(table.status),
]);

export const model = pgTable("model", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: varchar("model_id", { length: 100 }).notNull(),
  modelName: varchar("model_name", { length: 255 }).notNull(),
  applicableType: varchar("applicable_type", { length: 100 }),
  /**
   * @type { name: string; type: string; required: boolean; description?: string; defaultValue?: string | number }
   */
  inputVars: jsonb("input_vars"),
  formulaLogic: text("formula_logic"),
  /**
   * @type { key: string; value: string | number }
   */
  constants: jsonb("constants"),
  constantsVersion: varchar("constants_version", { length: 50 }),
  maintainer: userProfile("maintainer"),
  status: varchar("status", { length: 50 }).default('draft'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_model_model_id").on(table.modelId),
  index("idx_model_status").on(table.status),
]);

export const unitStd = pgTable("unit_std", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitStd: varchar("unit_std", { length: 50 }).notNull(),
  /**
   * @type string[]
   */
  aliases: jsonb("aliases"),
  convertible: boolean("convertible").default(false),
  convertCoefficient: numeric("convert_coefficient").default('1.0'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_unit_std_unit").on(table.unitStd),
]);

export const estimateTask = pgTable("estimate_task", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default('pending'),
  totalRows: integer("total_rows").default(0),
  successRows: integer("success_rows").default(0),
  jiaGongRows: integer("jia_gong_rows").default(0),
  pendingRows: integer("pending_rows").default(0),
  mainResultUrl: text("main_result_url"),
  unknownResultUrl: text("unknown_result_url"),
  domain: varchar("domain", { length: 50 }).notNull().default('welding'),
  rowResults: jsonb("row_results"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_estimate_task_status").on(table.status),
]);

export const pendingItem = pgTable("pending_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id"),
  groupType: varchar("group_type", { length: 50 }).notNull(),
  modelId: varchar("model_id", { length: 100 }),
  deviceName: varchar("device_name", { length: 255 }).notNull(),
  /**
   * @type { name: string; type: string; required: boolean; value?: string | number }
   */
  params: jsonb("params"),
  /**
   * @type { key: string; value: string | number }
   */
  filledValues: jsonb("filled_values"),
  status: varchar("status", { length: 50 }).default('pending'),
  specRemark: varchar("spec_remark", { length: 500 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_pending_item_task_id").on(table.taskId),
  index("idx_pending_item_group_type").on(table.groupType),
  index("idx_pending_item_status").on(table.status),
]);

export const agentMessage = pgTable("agent_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  content: text("content"),
  messageType: varchar("message_type", { length: 50 }).default('text'),
  /**
   * @type { devices: { name: string; matched_model_id: string; matched_model_name: string; confidence: number; match_reason: string }[]; params: Record<string, string | number>; anomalies: { device_name: string; calculated_price: number; historical_avg: number; deviation: number; level: string }[]; file_name: string; task_id: string; stats: { total: number; matched: number; pending: number } }
   */
  metadata: jsonb("metadata"),
  status: varchar("status", { length: 50 }).default('sent'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_agent_message_session_id").on(table.sessionId),
]);

export const agentSession = pgTable("agent_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }),
  status: varchar("status", { length: 50 }).default('active'),
  taskId: uuid("task_id"),
  /**
   * @type { task_id: string; total_rows: number; matched_rows: number; pending_rows: number; current_step: string }
   */
  context: jsonb("context"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  index("idx_agent_session_status").on(table.status),
  index("idx_agent_session_task_id").on(table.taskId),
]);

export const authzRolePermissions = pgTable("authz_role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleKey: varchar("role_key", { length: 100 }).notNull(),
  permissionId: uuid("permission_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("authz_role_permissions_role_key_permission_id_key").on(table.roleKey, table.permissionId),
  index("idx_authz_role_permissions_role_key").on(table.roleKey),
  foreignKey({
    columns: [table.permissionId],
    foreignColumns: [authzPermissions.id],
    name: "authz_role_permissions_permission_id_fkey",
  }).onDelete("cascade"),
]);

export const authzPermissions = pgTable("authz_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: varchar("action", { length: 100 }).notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  description: text("description"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("authz_permissions_action_subject_key").on(table.action, table.subject),
]);

export const archiveLog = pgTable("archive_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  operator: varchar("operator", { length: 255 }).notNull(),
  operateTime: varchar("operate_time", { length: 50 }).notNull(),
  count: integer("count").notNull().default(0),
  batchId: uuid("batch_id"),
  batchName: varchar("batch_name", { length: 255 }),
  domain: varchar("domain", { length: 50 }),
});

export const previewStore = pgTable("preview_store", {
  previewId: varchar("preview_id", { length: 255 }).primaryKey(),
  domain: varchar("domain", { length: 50 }).notNull().default('welding'),
  items: jsonb("items").notNull(),
  createdAt: integer("created_at").notNull(),
});

// table aliases
export const agentMessageTable = agentMessage;
export const agentSessionTable = agentSession;
export const archiveLogTable = archiveLog;
export const authzPermissionsTable = authzPermissions;
export const authzRolePermissionsTable = authzRolePermissions;
export const contractTable = contract;
export const estimateTaskTable = estimateTask;
export const manufacturingContractTable = manufacturingContract;
export const modelTable = model;
export const paintingContractTable = paintingContract;
export const pendingItemTable = pendingItem;
export const previewStoreTable = previewStore;
export const stampingContractTable = stampingContract;
export const unitStdTable = unitStd;
