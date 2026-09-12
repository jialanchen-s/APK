import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { model as models } from '@server/database/schema';
import { eq, sql, count, desc } from 'drizzle-orm';
import type {
  ModelItem,
  ModelListResponse,
  SaveModelRequest,
  SaveModelResponse,
  TryoutResponse,
  PublishModelResponse,
  ModelVersion,
  ModelVersionsResponse,
} from '@shared/api.interface';

interface ModelRow {
  id: string;
  model_id: string;
  model_name: string;
  applicable_type: string | null;
  input_vars: unknown;
  formula_logic: string | null;
  constants: unknown;
  constants_version: string | null;
  maintainer: string | null;
  status: string | null;
  updated_at: Date;
}

@Injectable()
export class ModelService {
  private readonly logger = new Logger(ModelService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async list(page: number, pageSize: number): Promise<ModelListResponse> {
    this.logger.log(`list: page=${page}, pageSize=${pageSize}`);
    const pageNum = page < 1 ? 1 : page;
    const pageSizeNum = pageSize < 1 ? 20 : pageSize;
    const offset = (pageNum - 1) * pageSizeNum;

    const rows = await this.db
      .select({
        id: models.id,
        model_id: models.modelId,
        model_name: models.modelName,
        applicable_type: models.applicableType,
        input_vars: models.inputVars,
        formula_logic: models.formulaLogic,
        constants: models.constants,
        constants_version: models.constantsVersion,
        maintainer: sql<string>`(${models.maintainer}).user_id`,
        status: models.status,
        updated_at: models.updatedAt,
      })
      .from(models)
      .orderBy(desc(models.updatedAt))
      .limit(pageSizeNum)
      .offset(offset);

    const totalRows = await this.db
      .select({ value: count() })
      .from(models);
    const total = Number(totalRows[0]?.value ?? 0);

    const items: ModelItem[] = rows.map((row: ModelRow) => this.toModelItem(row));
    return { items, total };
  }

  async save(userId: string, data: SaveModelRequest): Promise<SaveModelResponse> {
    this.logger.log(`save: userId=${userId}, modelName=${data.model_name}, id=${data.id ?? '(new)'}`);

    const inputVarsJson = JSON.stringify(data.input_vars ?? []);
    const constantsJson = JSON.stringify(data.constants ?? {});

    if (data.id) {
      await this.db
        .update(models)
        .set({
          modelName: data.model_name,
          applicableType: data.applicable_type,
          inputVars: sql`${inputVarsJson}::jsonb`,
          formulaLogic: data.formula_logic,
          constants: sql`${constantsJson}::jsonb`,
          maintainer: sql`ROW(${userId})::user_profile`,
          updatedBy: sql`ROW(${userId})::user_profile`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(models.id, data.id));
      return { id: data.id, success: true };
    }

    const modelId = `M-${Date.now()}`;
    const [inserted] = await this.db
      .insert(models)
      .values({
        modelId,
        modelName: data.model_name,
        applicableType: data.applicable_type,
        inputVars: sql`${inputVarsJson}::jsonb`,
        formulaLogic: data.formula_logic,
        constants: sql`${constantsJson}::jsonb`,
        constantsVersion: 'v1',
        maintainer: sql`ROW(${userId})::user_profile`,
        status: 'draft',
        createdBy: sql`ROW(${userId})::user_profile`,
        updatedBy: sql`ROW(${userId})::user_profile`,
      })
      .returning({ id: models.id });

    return { id: inserted.id, success: true };
  }

  async tryout(id: string, params: Record<string, string | number>): Promise<TryoutResponse> {
    this.logger.log(`tryout: id=${id}, params=${JSON.stringify(params)}`);

    const rows = await this.db
      .select({
        formula_logic: models.formulaLogic,
        constants: models.constants,
        input_vars: models.inputVars,
      })
      .from(models)
      .where(eq(models.id, id))
      .limit(1);

    if (rows.length === 0) {
      return { success: false, error: '模型不存在' };
    }

    const formula = rows[0].formula_logic ?? '';
    const constants = (rows[0].constants ?? {}) as Record<string, string | number>;

    return this.evaluateFormula(formula, params, constants);
  }

  async tryoutByModelId(
    modelId: string,
    params: Record<string, string | number>,
  ): Promise<TryoutResponse> {
    this.logger.log(`tryoutByModelId: modelId=${modelId}, params=${JSON.stringify(params)}`);

    const rows = await this.db
      .select({
        formula_logic: models.formulaLogic,
        constants: models.constants,
        input_vars: models.inputVars,
      })
      .from(models)
      .where(eq(models.modelId, modelId))
      .limit(1);

    if (rows.length === 0) {
      return { success: false, error: '模型不存在' };
    }

    const formula = rows[0].formula_logic ?? '';
    const constants = (rows[0].constants ?? {}) as Record<string, string | number>;

    return this.evaluateFormula(formula, params, constants);
  }

  async publish(userId: string, id: string): Promise<PublishModelResponse> {
    this.logger.log(`publish: userId=${userId}, id=${id}`);

    const rows = await this.db
      .select({
        formula_logic: models.formulaLogic,
        constants: models.constants,
        input_vars: models.inputVars,
        model_name: models.modelName,
      })
      .from(models)
      .where(eq(models.id, id))
      .limit(1);

    if (rows.length === 0) {
      return { success: false, version: '' };
    }

    const formula = rows[0].formula_logic ?? '';
    const constants = (rows[0].constants ?? {}) as Record<string, string | number>;
    const inputVars = (rows[0].input_vars ?? []) as Array<{
      name: string;
      type: string;
      required: boolean;
      defaultValue?: string | number;
    }>;

    const defaultParams: Record<string, string | number> = {};
    for (const v of inputVars) {
      if (v.defaultValue !== undefined && v.defaultValue !== null && v.defaultValue !== '') {
        defaultParams[v.name] = v.defaultValue;
      } else {
        defaultParams[v.name] = v.type === 'string' ? '' : 1;
      }
    }

    const check = this.evaluateFormula(formula, defaultParams, constants);
    if (!check.success) {
      return { success: false, version: '' };
    }

    const version = `v${Date.now()}`;
    await this.db
      .update(models)
      .set({
        status: 'published',
        constantsVersion: version,
        updatedBy: sql`ROW(${userId})::user_profile`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(models.id, id));

    return { success: true, version };
  }

  async getVersions(id: string, page: number, pageSize: number): Promise<ModelVersionsResponse> {
    this.logger.log(`getVersions: id=${id}, page=${page}, pageSize=${pageSize}`);

    const rows = await this.db
      .select({
        constants_version: models.constantsVersion,
        status: models.status,
        updated_at: models.updatedAt,
        updated_by: sql<string>`(${models.updatedBy}).user_id`,
      })
      .from(models)
      .where(eq(models.id, id))
      .limit(1);

    if (rows.length === 0) {
      return { items: [], total: 0 };
    }

    const row = rows[0];
    const versions: ModelVersion[] = [];

    if (row.constants_version) {
      versions.push({
        version: row.constants_version,
        operator: row.updated_by ?? '—',
        operate_time: row.updated_at.toISOString(),
        change_log: row.status === 'published' ? '发布版本' : '草稿版本',
      });
    }

    const pageNum = page < 1 ? 1 : page;
    const pageSizeNum = pageSize < 1 ? 20 : pageSize;
    const total = versions.length;
    const offset = (pageNum - 1) * pageSizeNum;
    const items = versions.slice(offset, offset + pageSizeNum);

    return { items, total };
  }

  private toModelItem(row: ModelRow): ModelItem {
    return {
      id: row.id,
      model_id: row.model_id,
      model_name: row.model_name,
      applicable_type: row.applicable_type ?? '',
      input_vars: (row.input_vars ?? []) as ModelItem['input_vars'],
      formula_logic: row.formula_logic ?? '',
      constants: (row.constants ?? {}) as ModelItem['constants'],
      constants_version: row.constants_version ?? '',
      maintainer: row.maintainer ?? '',
      status: (row.status ?? 'draft') as ModelItem['status'],
      updated_at: row.updated_at.toISOString(),
    };
  }

  private escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  }

  public evaluateFormula(
    formula: string,
    params: Record<string, string | number>,
    constants: Record<string, string | number>,
  ): TryoutResponse {
    if (!formula || formula.trim() === '') {
      return { success: false, error: '公式为空' };
    }

    const scope: Record<string, string | number> = { ...constants, ...params };
    let expr = formula;

    // 1. 替换 @变量名（支持中文字符，按长度降序避免部分匹配）
    const allKeys = Object.keys(scope).sort((a, b) => b.length - a.length);
    for (const key of allKeys) {
      const atRegex = new RegExp(`@${this.escapeRegExp(key)}`, 'g');
      if (atRegex.test(expr)) {
        const val = scope[key];
        if (typeof val === 'string' && val.trim() === '') {
          return { success: false, error: `变量 @${key} 值为空` };
        }
        const numVal = Number(val);
        if (Number.isNaN(numVal)) {
          return { success: false, error: `变量 @${key} 非数字: ${val}` };
        }
        expr = expr.replace(atRegex, String(numVal));
      }
    }

    // 2. 检查是否还有未替换的 @变量引用
    const remainingVars = expr.match(/@[\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*/g);
    if (remainingVars) {
      return { success: false, error: `未定义变量: ${remainingVars[0]}` };
    }

    // 3. 替换裸常量名（无 @ 前缀，按长度降序避免部分匹配）
    const constantKeys = Object.keys(constants).sort((a, b) => b.length - a.length);
    for (const key of constantKeys) {
      const escaped = this.escapeRegExp(key);
      const bareRegex = new RegExp(
        `(?<![@\\w\\u4e00-\\u9fa5])${escaped}(?![\\w\\u4e00-\\u9fa5])`,
        'g',
      );
      if (bareRegex.test(expr)) {
        const val = constants[key];
        const numVal = Number(val);
        if (Number.isNaN(numVal)) {
          return { success: false, error: `常量 ${key} 非数字: ${val}` };
        }
        expr = expr.replace(bareRegex, String(numVal));
      }
    }

    // 4. 安全检查：仅允许数字、运算符、括号、空格、max/min/abs/逗号
    const sanitized = expr.replace(/max|min|abs/g, '');
    if (!/^[\d+\-*/()\s.,]*$/.test(sanitized)) {
      const illegalChars = sanitized.match(/[^\d+\-*/()\s.,]/g);
      const illegalStr = illegalChars ? [...new Set(illegalChars)].join('') : '';
      return { success: false, error: `公式包含非法字符: ${illegalStr}` };
    }

    try {
      const fn = new Function('max', 'min', 'abs', `"use strict"; return (${expr});`) as (
        max: (...n: number[]) => number,
        min: (...n: number[]) => number,
        abs: (n: number) => number,
      ) => number;

      const maxFn = (...n: number[]): number => Math.max(...n);
      const minFn = (...n: number[]): number => Math.min(...n);
      const absFn = (n: number): number => Math.abs(n);

      const result = fn(maxFn, minFn, absFn);

      if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
        return { success: false, error: '计算结果无效' };
      }

      return { success: true, result: Math.round(result * 10000) / 10000 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.log(`evaluateFormula error: ${msg}`);
      return { success: false, error: `公式执行错误: ${msg}` };
    }
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const deleted = await this.db.delete(models).where(eq(models.id, id)).returning({ id: models.id });
    if (deleted.length === 0) {
      throw new NotFoundException('模型不存在');
    }
    return { success: true };
  }
}
