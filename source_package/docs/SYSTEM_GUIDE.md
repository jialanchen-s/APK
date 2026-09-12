# 焊装费用核算系统 - 系统说明文档

## 一、系统概述

本系统是面向汽车焊装成本工程师的**焊装设备费用核算平台**，核心能力包括：上传预算清单自动测算、历史合同价格检索、公式模型建模、AI 智能参数提取与异常检测、对话式 AI 核算助手。

系统采用前后端分离架构，前端 React + 后端 NestJS，共享 PostgreSQL 数据库。

---

## 二、功能模块一览

| 模块 | 路由 | 核心功能 |
|------|------|----------|
| 测算工作台 | `/` | 上传 Excel/BOM → 自动瀑布流寻价 → 展示结果与异常 → 导出 |
| 批量参数填报 | `/batch-fill` | 对测算中未匹配的设备批量填报参数、套用模型、提交计算 |
| 历史合同归档 | `/contract-archive` | 上传历史合同 Excel → 解析预览 → 批量归档入库 |
| 历史价格快查 | `/price-query` | 按设备名/线别/供应方式等多条件检索历史合同价格 |
| 建模台 | `/model-studio` | 创建/编辑核算公式模型、试算验证、发布模型 |
| AI 核算助手 | `/agent` | 对话式 AI 助手，支持自然语言查价、测算、参数提取等 |

---

## 三、核心功能底层逻辑

### 3.1 测算工作台 —— 瀑布流寻价算法

这是系统的核心算法，位于 `server/modules/estimate-task/estimate-task.service.ts` 的 `processRow` 方法。

用户上传设备清单后，系统对每一行设备按以下优先级**逐层尝试匹配**，命中即返回，未命中则进入下一层：

```
甲供设备
  └─ 直接返回 price=0，标记"甲供"

层1: 同线精确匹配
  └─ 设备名 + 线别 + 改造等级 完全一致 → 取最近2条合同均价
  └─ 精确失败 → 设备名模糊匹配(like %name%) → 取最近2条均价

层2: 任务线降级匹配
  └─ 当设备行线别 ≠ 任务产线时，用任务产线替换后再精确/模糊匹配

层3: 通用设备跨线参考
  └─ usage_scope=通用 → 排除当前线别，查其他线合同均价

层4: 改造设备测算
  └─ 查同设备"新增"合同作为基价 → 基价 × 改造系数
  └─ 可选：AI提取参数 + 模型精算基价，再 × 系数

层5: 模型公式测算
  └─ AI提取参数 → 匹配已发布模型 → 执行公式计算

层6: 待人工处理
  └─ 创建 pending_item 记录，等待用户在"批量填报"中补充参数
```

**改造系数表**：

| 改造等级 | 系数（占新增设备价格比例） |
|----------|---------------------------|
| 改造-微  | 10%                       |
| 改造-小  | 20%                       |
| 改造-中  | 35%                       |
| 改造-大  | 50%                       |

**合同匹配取价规则**：取归档时间最近的 2 条合同记录，计算算术平均值作为预算价格。若来自不同项目，标注"XX、YY 均价"。

**异步处理机制**：
- `createTask` 接口插入数据库记录后**立即返回** taskId（status=processing）
- 实际测算在后台 `processTask` 异步执行
- 前端每 2 秒轮询 `GET /api/estimate-tasks/:id` 获取最新状态
- 测算完成后状态变为 success/failed，前端停止轮询

**AI 参数预提取**：
- 测算前先收集所有非甲供设备的唯一文本（设备名 + 规格备注）
- 每批 3 个并行调用 AI 插件提取参数，批间间隔 2 秒（避免限流）
- 提取结果缓存在内存 Map 中，后续瀑布流各层共享
- 限流时自动重试（3s/6s/9s 递增延迟，最多 3 次）

### 3.2 异常检测

测算完成后自动触发（也可手动触发），位于 `runAnomalyDetection` 方法。

- 筛选所有成功匹配且价格 > 0 的设备
- 拼接为对比文本，调用 `welding_cost_anomaly_detection_1` AI 插件
- AI 对比测算价格与历史合同均价，输出：
  - 风险等级（low / medium / high）
  - 异常设备列表（偏离 >15% 标记 warning，>30% 标记 critical）
  - 总体评估和处理建议

### 3.3 建模台 —— 公式引擎

位于 `server/modules/model/model.service.ts` 的 `evaluateFormula` 方法。

**公式编写规范**：
- 变量用 `@` 前缀引用，如 `@设备重量`、`@功率`
- 常量直接用名称引用（无 `@`），如 `材料单价`
- 支持 `max()`、`min()`、`abs()` 函数
- 支持四则运算 `+ - * /` 和括号

**公式执行流程**：
1. 按变量名长度降序替换 `@变量` 为实际数值（避免短名抢先匹配长名）
2. 替换裸常量名为常量值
3. 安全校验：仅允许数字、运算符、`max/min/abs`
4. `new Function('max','min','abs', ...)` 沙盒执行
5. 结果保留 4 位小数

**示例公式**：`@设备重量 * 材料单价 + max(@功率 * 0.5, 100)`

**模型生命周期**：草稿(draft) → 试算验证 → 发布(published)，只有 published 状态的模型才会被测算流程使用。

### 3.4 批量参数填报

测算中未能自动匹配的设备会进入 `pending_item` 表，按分组类型分类：

| 分组类型 | 含义 | 触发条件 |
|----------|------|----------|
| `model_param` | 模型参数缺失 | 设备匹配到模型但缺少必填参数 |
| `retrofit_param` | 改造参数缺失 | 改造设备缺少计算所需参数 |
| `no_data` | 无数据匹配 | 既无合同又无匹配模型 |

**操作流程**：
1. 左侧分组导航查看各类待处理项
2. 可批量套用模型（ModelSelectDialog 选择模型）
3. 手动编辑参数值
4. 提交计算 → 逐条执行模型公式 → 更新测算结果

### 3.5 历史合同归档

**流程**：上传 Excel → 后端解析校验 → 预览确认 → 批量入库

- 解析时校验价格（<0 或 >1000万 标记为 invalid）
- 归档时生成批次 ID 和批次名（格式：日期_线别_数量）
- 支持按批次删除、按 ID 删除

合同表是瀑布流寻价的数据基础，归档的合同越多，测算匹配率越高。

### 3.6 历史价格快查

多条件检索合同记录：
- 设备名（模糊匹配）
- 项目编号（模糊匹配）
- 线别、专通用、供货方式（精确匹配）
- 归档时期（近期/历史，"近期"= 最后一次归档日期当天及之后）

返回匹配记录列表 + 统计信息（均价/最低价/最高价/数量），支持导出 Excel。

### 3.7 AI 核算助手

两种交互模式：

**模式一：自然语言对话（ReAct 循环）**

用户发文本消息 → AI 自主决策调用工具 → 基于工具结果回答。

```
用户消息 + 系统提示 + 对话历史 + 工具观察结果
  → LLM 输出 JSON {thought, action, parameters}
  → 执行工具，结果加入 observations
  → 下一轮 LLM 调用
  → 最多 10 轮，输出 final_answer 时结束
```

系统提示词定义了助手角色：
- 焊装费用核算 Agent + 通用知识 AI
- 价格问题：优先查系统数据，系统无数据时给行业参考（标注"行业参考"）
- 通用问题（工艺、设备原理等）：直接用知识回答
- 正式测算任务价格必须来自工具结果（可溯源）

**模式二：文件上传交互式向导**

```
上传 Excel → 创建测算任务
  → AI 智能匹配模型 → 用户确认/跳过
  → AI 提取设备参数 → 用户确认/跳过
  → 执行公式计算 + 异常检测 → 用户确认
  → 会话完成
```

**9 个 Agent 工具**：

| 工具 | 功能 |
|------|------|
| `search_contracts` | 搜索历史合同价格 |
| `create_estimate_task` | 创建测算任务（触发完整瀑布流） |
| `get_task_status` | 查询任务状态 |
| `get_task_items` | 获取任务结果明细 |
| `find_published_models` | 列出已发布模型 |
| `extract_device_params` | AI 提取设备参数 |
| `calculate_model_price` | 模型公式计算价格 |
| `get_pending_items` | 获取待处理设备 |
| `detect_anomalies` | 异常检测 |

---

## 四、数据库设计

共 7 张业务表：

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `estimate_task` | 测算任务 | file_name, status, total_rows, success_rows, jia_gong_rows, pending_rows |
| `pending_item` | 待处理设备项 | task_id, group_type, model_id, device_name, params, filled_values, status |
| `contract` | 历史合同归档 | project, line_type, device_material_name, unit_price, supply, settle_date, archive_batch_id |
| `model` | 核算模型 | model_id, model_name, applicable_type, input_vars, formula_logic, constants, status |
| `agent_session` | AI助手会话 | title, status, task_id, context |
| `agent_message` | AI助手消息 | session_id, role, content, message_type, metadata, status |
| `unit_std` | 单位标准库 | unit_std, aliases, convertible, convert_coefficient |

**核心关联关系**：
- `estimate_task` 1:N `pending_item`（通过 task_id）
- `agent_session` 1:1 `estimate_task`（通过 task_id）
- `agent_session` 1:N `agent_message`（通过 session_id）
- `contract` 无外键关联，作为独立的历史数据源被测算流程查询

---

## 五、AI 插件能力

系统通过 5 个 AI 插件实现智能化能力：

| 插件 ID | 调用方法 | 用途 |
|---------|----------|------|
| `welding_equipment_param_extract_1` | `textToJson` | 从设备名称/描述提取 15 类参数（重量、功率、电压、品牌、型号等） |
| `welding_cost_anomaly_detection_1` | `textToJson` | 对比测算价格与历史均价，输出异常等级和风险评估 |
| `welding_cost_calculation_chat_assistant_1` | `textGenerate` | Agent 对话核心，理解用户意图并生成回复 |
| `welding_equipment_intelligent_matching_1` | `textToJson` | 根据设备名和模型列表，智能匹配最合适的核算模型 |
| `welding_equipment_param_extraction_1` | - | 设备参数提取（Agent 交互式向导中使用） |

**AI 参数提取支持的字段**：

| 字段 | 中文别名 |
|------|----------|
| weight | 重量 |
| power | 功率 |
| voltage | 电压 |
| current | 电流 |
| pressure | 压力 |
| frequency | 频率 |
| size | 尺寸/规格尺寸 |
| material | 材质 |
| brand | 品牌 |
| model_spec | 型号/规格型号 |
| welding_type | 焊接类型/焊接方式 |
| workpiece_thickness | 工件厚度/板厚 |
| electrode_diameter | 电极直径 |
| cycle_time | 节拍/工作节拍 |
| quantity | 数量 |

---

## 六、技术架构

```
┌─────────────────────────────────────────────┐
│                  前端 (React 19)              │
│  React Router + TailwindCSS + shadcn/ui     │
│  axiosForBackend + 轮询/事件驱动             │
├─────────────────────────────────────────────┤
│                  后端 (NestJS 10)             │
│  Controller → Service → Drizzle ORM         │
│  CapabilityService (AI 插件调用)             │
├─────────────────────────────────────────────┤
│              PostgreSQL 数据库                │
│  7 张业务表 + RLS 行级权限                    │
├─────────────────────────────────────────────┤
│              AI 能力层 (5 个插件)             │
│  参数提取 / 异常检测 / 对话助手 /             │
│  智能匹配 / 参数提取(向导版)                  │
└─────────────────────────────────────────────┘
```

**技术栈**：
- 前端：React 19 + TypeScript + TailwindCSS + shadcn/ui + Framer Motion
- 后端：NestJS 10 + Drizzle ORM + PostgreSQL
- AI：平台内置插件（文本生成、文本转 JSON）
- 文件：前端 XLSX 解析/导出，dataloom 存储

---

## 七、API 接口清单

### 测算任务
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/estimate-tasks` | 创建测算任务（异步，立即返回 taskId） |
| GET | `/api/estimate-tasks/:id` | 获取任务状态和统计 |
| GET | `/api/estimate-tasks/:id/items` | 获取结果明细（分页+筛选） |
| GET | `/api/estimate-tasks/:id/download/:type` | 下载结果文件 |
| GET | `/api/estimate-tasks/:id/anomaly` | 获取异常检测结果 |

### 待处理项
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/pending-items/groups` | 获取分组统计 |
| GET | `/api/pending-items` | 获取待处理项列表（分页+分组筛选） |
| POST | `/api/pending-items/batch-apply` | 批量套用参数 |
| POST | `/api/pending-items/submit` | 提交计算 |
| POST | `/api/pending-items/apply-model` | 应用模型 |
| POST | `/api/pending-items/reset` | 重置任务待处理项 |
| GET | `/api/pending-items/latest-task` | 获取最新任务 |

### 合同管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/contracts/parse` | 解析合同文件 |
| GET | `/api/contracts/preview` | 预览（分页） |
| POST | `/api/contracts/archive` | 归档入库 |
| GET | `/api/contracts/archives/logs` | 归档日志 |
| DELETE | `/api/contracts/archives` | 删除已归档合同 |

### 模型管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/models` | 模型列表（分页） |
| POST | `/api/models` | 保存模型 |
| POST | `/api/models/:id/tryout` | 试算 |
| POST | `/api/models/:id/publish` | 发布 |
| GET | `/api/models/:id/versions` | 版本列表 |

### 价格快查
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/price-query` | 多条件检索历史价格 |

### AI 助手
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agent/sessions` | 创建会话 |
| GET | `/api/agent/sessions` | 会话列表 |
| GET | `/api/agent/sessions/:id` | 会话详情 |
| DELETE | `/api/agent/sessions/:id` | 删除会话 |
| POST | `/api/agent/sessions/:id/messages` | 发送消息（文件上传/文本） |
| POST | `/api/agent/sessions/:id/chat` | 对话（ReAct 循环） |
| POST | `/api/agent/sessions/:id/actions/:msgId/confirm` | 确认动作 |
| POST | `/api/agent/sessions/:id/actions/:msgId/reject` | 拒绝动作 |
| GET | `/api/agent/sessions/:id/context` | 获取上下文 |
