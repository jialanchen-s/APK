# 焊装费用智能测算与管理系统（迁移自源应用）

## 应用概览

- 面向汽车焊装工艺成本核算的全栈应用：测算工作台（Excel 导入 → 模型匹配 → 参数提取 → 公式计算 → 异常检测）、待填项批量填报、历史合同归档与审核、历史价格快查、建模台、AI 核算助手（Agent + 工具调用）、角色权限管理。
- 技术栈：React 19 + Tailwind 4 + shadcn/ui（client）、NestJS + Drizzle ORM + PostgreSQL（server）、共享类型在 `shared/`。
- 数据库共 12 张业务表：`authz_permissions` / `authz_role_permissions`（权限点位与角色绑定）、`estimate_task` / `pending_item`（测算任务与待填项）、`contract`（焊装合同归档，含 `project_time` 项目时间 / `factory_name` 工厂名称）、`manufacturing_contract`（总装费用合同归档，结构与 contract 一致）、`painting_contract`（涂装费用合同归档，结构与 manufacturing_contract 一致）、`stamping_contract`（冲压费用合同归档，结构同上）、`model`（核算模型）、`unit_std`（单位换算）、`agent_session` / `agent_message`（AI 会话）。
- 权限体系：平台角色（`/api/role_manager`）↔ `authz_role_permissions.role_key` ↔ `DbPermissionResolver`，前端经 `ProtectedRoute` 按 `{action, subject}` 守卫 7 个业务路由；默认角色 `admin` 持有全部权限点位（含 `edit/ContractArchive`：按项目批量编辑项目时间/工厂名称，提交审核弹窗也可写入这两项；接口 `POST /api/contracts/archives/projects/update`，按 project 名更新该域下全部归档行）。
- 合同归档支持四合同库（`ArchiveDomain`: welding → `contract` 表 / manufacturing → `manufacturing_contract` 表（界面显示「总装费用库」，内部 key 与表名沿用 manufacturing） / painting → `painting_contract` 表 / stamping → `stamping_contract` 表）：归档页顶部选择合同库，domain 贯穿 parse → archive → reviews → batches → price-query 全链路（服务端 controller `normalizeDomain` 校验四域，默认 welding）。价格快查页同样可切换合同库。总装/涂装/冲压三个费用库**不分线别**：上传 PDF 时不识别文件名线别、不传 line_type；解析输出字段为「项目/设备名称/规格型号/单价/价格口径/单位/数量/小计/品牌/结算日期/备注」，对应 `specification` 规格字段；预览表、审核详情均按 domain 切换列（焊装显示线别，三个费用库显示规格）。批次名后缀按域显示名（总装费用/涂装费用/冲压费用，共享常量 `ARCHIVE_DOMAIN_LABELS` / `ARCHIVE_DOMAIN_VALUES` 在 shared/api.interface.ts）。
- 合同归档支持 PDF/图片识别：前端将文件按 512KB 分片转 base64，依次 POST JSON 到 `/api/contracts/pdf-upload/init`（传 `file_type`：pdf/image）→ `pdf-upload/chunk` → `pdf-upload/complete`；complete **立即返回 task_id**（异步识别，不同步等插件），前端每 2s 轮询 `GET /api/contracts/pdf-upload/status/:taskId`（parsing → extracting（含 done/total 片进度）→ completed/failed，前端轮询 15 分钟上限）。服务端由 `ContractPdfUploadService`（contract-pdf-upload.service.ts，内存会话 + 任务 Map，30 分钟 TTL）编排：PDF 走 `FileService.upload` 落存储 → `createSignedUrl` → `file_parse_text_1` 解析；图片（PNG/JPG/WEBP）走同一上传通道 → `image_content_intelligent_recognition_1`（imageUnderstanding，服务端 callStream 收集 content 转写文本）→ 复用 `ContractService.extractRowsFromText` 按 domain 选提取插件（焊装 `contract_detail_extract_1`、制造费用 `manufacturing_contract_detail_extract_1`）→ 预览编辑后提交审核。提取任务总预算 15 分钟、文本上限 30 万字符（分片 8000 字符）；任务失败保留会话，重调 complete 复用进行中任务或重建。注意：平台网关会截断 multipart 上传体（表现为 400 `Multipart: Unexpected end of form`），multipart 通道不可用，禁用改回 FormData 直传；单请求 JSON body 上限约 1MB，分片 base64 后约 700KB 必须保持在此以内；图片识别插件实例的 `modelParams.temperature`/`maxTokens` 必须是数字（字符串会导致输入校验失败）。沙箱内 dataloom 前端上传（pre_upload/acquire_upload_url）与 capabilityClient 直传 File 均不可用（404），插件只能消费服务端 createSignedUrl 生成的链接。旧的 `/api/contracts/extract-pdf-upload` multipart 接口保留但前端已不使用。
- 驳回数据清理双机制：① 批次管理 tab 提供「清理驳回批次」按钮（仅当前域，后端 `POST /api/contracts/archives/clear-rejected`，`@Can('delete','ContractArchive')`，物理删除该域全部 status='rejected' 行）；② 自动化任务 `contract.automation.ts`（`@Automation` + `@BindTrigger('clear_expired_rejected_batches')`，cron 每日 03:00，触发器创建后需用户在平台侧启用）删除四域中驳回超过 30 天（review_time < now-30d）的行；`ContractService.cleanExpiredRejected` / `clearRejectedBatches` 分别承载两者。
- 9 个插件实例（ID 已被代码硬编码，禁止改名）：`welding_cost_calculation_chat_assistant_1`（Agent LLM 大脑）、`welding_equipment_param_extract_1` / `welding_equipment_param_extraction_1`（参数提取）、`welding_equipment_intelligent_matching_1`（模型匹配）、`welding_cost_anomaly_detection_1`（异常检测）、`file_parse_text_1`（文档解析）、`image_content_intelligent_recognition_1`（图片识别，流式，合同归档图片上传链路使用）、`contract_detail_extract_1`（焊装合同文本结构化提取，textToJson 实例）、`manufacturing_contract_detail_extract_1`（非焊装合同文本结构化提取，textToJson 实例，总装/涂装/冲压三域共用，输出含 specification 规格字段，无线别）。
- textToJson 系列实例的输出字段全部必填（平台限制），prompt 已要求缺失字段填 0/空字符串，禁止改动为返回 null。
- textToJson 系列实例的 `paramDescription` 受插件 500 字符上限约束：字段详细说明必须写在 `prompt` 里，paramDescription 只留精简版，否则输入校验 500。

## 路由

| 路径 | 页面 | 权限 |
|------|------|------|
| `/` | 测算工作台 EstimateWorkbench | create/EstimateTask |
| `/batch-fill` | 批量参数填报 BatchFill | update/PendingItem |
| `/contract-archive` | 历史合同归档 ContractArchive | read/ContractArchive |
| `/price-query` | 历史价格快查 PriceQuery | read/PriceQuery |
| `/model-studio` | 建模台 ModelStudio | read/Model |
| `/agent` | AI 核算助手 AgentChat | use/Agent |
| `/role-management` | 角色管理 RoleManagementPage | manage/Permission |

## 服务端模块

`server/modules/`：`permission`（点位 + 权限解析器）、`role-manager`（平台角色 CRUD）、`estimate-task`（测算任务全流程）、`pending-item`（待填项）、`contract`（合同解析/归档/审核）、`model`（模型管理）、`agent`（AI 助手，ReAct 循环 + 工具调用）、`price-query`（价格查询）。全部在 `app.module.ts` 注册，`ViewModule` 保持最后。

# UI 设计指南（柔光素锦 / taste-soft-web）

## 1. Design Archetype (设计原型)

**Apple 级「柔光」高端网页风格**
- 银灰画布（非纯白）+ 双层描边卡片 + 大 squircle 圆角 + 深墨绿点睛
- 静谧、柔、有重量；环境 mesh 辉光做景深，弥散阴影替代硬投影

## 2. Color System (色彩系统)

| Token | 值 | 用途 |
|-------|-----|------|
| `--background` | `#F2F2F0` | 画布银灰底，禁纯白 |
| `--card` / `--popover` | `#FCFCFA` | 卡片内芯近白底（微暖） |
| `--secondary` / `--muted` | `#E8E8E5` | 次级银灰表面 |
| `--foreground` | `#0A0A0A` | 主文字（Off-Black，禁纯 `#000`） |
| `--muted-foreground` | `#57575A` | 次级文字 / 元数据 |
| `--primary` | `#0A0A0A` | 主 CTA 底色（墨色钮中钮），白字 `#F2F2F0` |
| `--accent` | `#E7EEEA` | 鼠标墨色/选中浅藏色表面，配 `--accent-foreground: #1F4D3F` |
| `--color-brand` | `#1F4D3F` | 深墨绿唯一强调：品牌 mark、圆点、进度 |
| `--color-brand-glow` | `#5A8C7A` | 浅鼠尾草：mesh 光晕、渐变端点 |
| `--color-sand` | `#C9B79A` | 暖砂点缀 |
| `--success` | `#1F4D3F` | 成功/通过（深墨绿） |
| `--warning` | `#A07E4F` | 待处理（暖砂） |
| `--destructive` | `#C45454` | 危险操作（柔化红） |
| `--border` | `rgba(10,10,10,0.08)` | 发丝边（禁 1px 实心灰） |

## 3. Typography (字体排版)

- 字族：`Plus Jakarta Sans`（标题与正文）+ `JetBrains Mono`（眉标/元数据），已通过 index.css 首行 `@import` 加载；**禁 Inter / Roboto / Helvetica / Open Sans**；CJK 兜底 PingFang SC / Microsoft YaHei / Noto Sans SC。
- 页面标题 `text-2xl font-bold tracking-tight`；区块标题 `text-lg font-bold`；卡片标题 `text-base font-semibold`。
- 正文 `text-sm leading-relaxed`；辅助 `text-xs text-muted-foreground`；数值右对齐 `text-right tabular-nums`；指标大数字 `text-3xl font-bold tabular-nums`。

## 4. Shapes & Elevation (圆角与阴影)

- 大 squircle：`rounded-3xl` = 2.25rem（外壳）、`rounded-2xl` = 1.375rem（内芯）；胶囊一律 `rounded-full`。重要卡片可用双层描边（外壳发丝边 + 弥散阴影，内芯 `bg-card` 同心更小圆角）。
- 阴影只准弥散：宽扩散、低透明、负 spread（`0 24px 48px -28px rgba(10,10,10,0.18)` 量级）；**禁 `shadow-md`/`shadow-lg` 硬投影**（theme 已全局映射为弥散形态）。
- 边框一律发丝环 `ring-1 ring-black/5` / `border-border`，禁 1px 实心灰。

## 5. Layout (布局)

- **左侧柔光侧边栏**（Layout.tsx）：`w-64` 折叠为 icon 侧的毛玻璃卡片，整栏套 `rounded-[1.85rem] bg-white/[0.55] backdrop-blur-xl` + 内嵌高光 + 发丝边 + 弥散阴影；不贴顶、不贴边，四周留白；品牌 mark 用 `from-brand to-brand-glow` 渐变小方块；菜单项胶囊圆角，激活态墨底浅字（`bg-foreground text-background`）。
- 顶部栏极简：`SidebarTrigger` 胶囊按钮 + 面包屑，无通栏。
- 业务页面各自 `max-w-[1400px] mx-auto` 控制内容宽度。
- 环境辉光：`.mesh-blob`（Layout 全局一层，径向 brand-glow、opacity 0.18、blur(90px)、fixed、pointer-events:none）。

## 6. Motion (运动)

- 缓动一律 `cubic-bezier(0.32,0.72,0,1)`（`--ease`）或弹簧 `cubic-bezier(0.16,1.16,0.3,1)`；**禁 linear / ease-in-out**；只补间 `transform` 与 `opacity`。
- Tailwind 默认过渡时序已全局指向 `--ease`；卡片 hover 抬升 `translateY(-3px)` + 阴影加深，600ms+。
- `prefers-reduced-motion: reduce` 下关闭 mesh 漂移。

## 7. Component Principles (组件原则)

- 优先 shadcn/ui 基础组件；表格用 `antd` 的 `Table`；用户展示必须用 `business-ui` 组件。
- 弹窗统一 Dialog（`rounded-3xl`），禁止原生 alert/confirm；表单校验 zod + react-hook-form。
- 图标 lucide-react 线性风格 `size-4`/`size-5`，禁 emoji 图标。

## 8. 应避免 (Anti-patterns)

- 纯白画布 / 纯黑文字（用 `#F2F2F0` / `#0A0A0A`）
- 硬投影 `shadow-md`+、1px 实心灰边、贴顶通栏导航、深色侧边栏
- linear / ease-in-out 过渡、动 width/height/top/left
- Inter / Roboto / Helvetica / Open Sans 字体
- 原生 `<input>` / `<select>` / `<textarea>`、硬编码用户 ID、mock 数据
