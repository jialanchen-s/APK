# UI 设计指南

> **设计类型**: App 设计（应用架构设计）
> **确认检查**: 本指南适用于可交互的应用/网站/工具。

## 1. Design Archetype (设计原型)

### 1.1 内容理解

-   **目标用户**: 汽车制造成本工程师与系统管理员；高频处理Excel数据、公式建模与合同归档；需要高效工具同时获得温暖安心感。
-   **核心目的**: 引导行动（上传/测算/填报）+ 建立信任（溯源透明/数据安全/清洗规则可见）。
-   **情绪基调**: 温暖、安心、掌控感；避免冷冰冰的工业感，强调精致与人文关怀。

### 1.2 设计方向

-   **Design Style**: Warm Premium — 暖色渐变底 + 白色超圆角卡片 + 浅绿色点缀。
-   **Application Type**: Admin/SaaS (Complex Web App) — 多模块工作台，含编辑器、表格、文件流。
-   **Aesthetic Direction**: 暖色线性渐变页面背景（warm gray / light green / mint 三色混合），白色超圆角卡片（32px），浅绿色 (#22C55E) 全局点缀色。

## 2. Color System (色彩系统)

**色彩关系**: 暖米渐变底 + 白色卡片 + 浅绿色点缀 + 深色反转侧边区
**配色设计理由**: 暖色调降低长时间盯屏疲劳，浅绿色传递活力与行动感，深色侧边区形成视觉对比层次
**主色推导**: #22C55E 作为唯一行动触发色，关联"测算/提交/发布"等核心业务动作
**使用比例**: 60% 暖色渐变底 / 25% 白色卡片容器 / 10% 深色侧边区 / 5% 浅绿色行动点

### 2.1 主题颜色

| Token                | HSL 值                  | 说明                                      |
| -------------------- | ----------------------- | ----------------------------------------- |
| `background`         | hsl(36 33% 93%)         | 暖色渐变底（配合 body gradient）          |
| `card`               | hsl(0 0% 100%)          | 卡片/容器背景，纯白突出数据区             |
| `foreground`         | hsl(215 25% 17%)        | 主文字 #1E293B，深灰蓝确保高对比度        |
| `muted-foreground`   | hsl(218 11% 65%)        | 次要文字/占位符 #9CA3AF                   |
| `primary`            | hsl(142 71% 45%)        | 浅绿色 #22C55E，主行动按钮/激活态         |
| `primary-foreground` | hsl(0 0% 100%)          | 主交互文字（白色文字在绿色上）            |
| `accent`             | hsl(142 71% 95%)        | 次级交互反馈，极浅绿                      |
| `accent-foreground`  | hsl(215 25% 25%)        | accent 上的文字                           |
| `border`             | hsl(220 14% 96%)        | 极浅灰 #F3F4F6，近乎不可见                |

### 2.2 导航区配色

-   **基调关系**: 深色侧边栏 `hsl(0 0% 18%)` (#2D2D2D) 形成视觉对比层，文字 `hsl(0 0% 85%)`
-   **关键状态**: 激活项使用 `primary` 浅绿色图标 + `bg-sidebar-accent` 背景；Hover 态背景微亮
-   **边界与背景**: 非透明深色底，侧边栏导航项使用 `rounded-2xl`

### 2.3 语义颜色

| 用途     | HSL 值            | 衍生说明                          |
| -------- | ----------------- | --------------------------------- |
| 成功/通过 | hsl(136 31% 52%)  | rgb(90,173,112)，用于测算完成/试算通过 |
| 警告/异常 | hsl(37 91% 55%)   | #FAAD14，用于清洗提示/跨线降级     |
| 错误/拦截 | hsl(0 84% 60%)    | #EF4444，用于必填缺失/校验失败     |

## 3. Typography (字体排版)

-   **唯一字体**: Inter (wght 300/400/500/600/700)
-   **Monospace/Data**: JetBrains Mono + "SF Mono", Consolas, monospace（表格数值/公式代码/版本号专用）
-   **字体策略**: Inter 无衬线主体保证屏幕可读性；等宽字体用于所有数字、代码、ID字段，强化对齐与精密感

### 文字层级

| 层级         | Tailwind 样式                                   | 颜色      |
| ------------ | ----------------------------------------------- | --------- |
| 页面大标题   | `text-4xl font-semibold tracking-tight`         | #1E293B   |
| 大数值 KPI   | `text-4xl font-light tracking-tight`            | 语义色     |
| 卡片标题     | `font-bold tracking-tight`                      | #1E293B   |
| 全大写标签   | `text-[10px] font-bold uppercase tracking-widest` | #9CA3AF  |
| 正文         | `text-sm`                                       | #6B7280   |
| 数据值       | `text-sm font-mono font-bold tracking-tight`    | #1E293B   |

## 4. Layout Strategy (布局策略)

-   **导航意图**: 需持久型全局侧边导航切换功能模块；深色侧边栏区分工作区
-   **页面架构**: 经典 Admin Shell（Sidebar + Header + Content），内容区 `max-w-[1400px]` 居中约束
-   **响应式**: 桌面端多栏并列；移动端隐藏侧栏折叠为抽屉
-   **页面背景**: 暖色 linear-gradient（warm gray / warm yellow / cream，各 0.6 透明度）

## 5. Visual Language (视觉语言)

-   **形态参数**: 圆角 `rounded-3xl (24px)` 卡片 · `rounded-full` 按钮/Logo · `rounded-2xl` 导航项/图标容器
-   **阴影策略**: 卡片 `shadow-sm`，hover → `shadow-md transition-all`；深色区域 `shadow-2xl`
-   **边框**: 白色卡片 `border border-gray-100`（极浅灰，近乎不可见）；深色区域 `border-white/10`
-   **识别签名**: 「超圆角白色卡片」「浅绿色点缀活跃态」「暖色渐变背景」「深色侧边栏对比层」
-   **动效原则**: 颜色过渡 `duration-500`；卡片 hover 阴影增强 + 上移 `hover:-translate-y-1`；数字跃动用 tabular-nums
-   **可及性**: 对比度 ≥ 4.5:1；交互元素 focus-visible 使用 `ring-2 ring-primary offset-2`

## 6. Component Principles (组件原则)

-   **状态完整性**: Button/Input/Select 覆盖 Default/Hover/Focus/Disabled/Error
-   **层级清晰**: Primary 黄色实心 / Secondary 白底边框 / Ghost 无边透明；按钮统一 `rounded-full`
-   **卡片统一**: 所有 Card 使用 `rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all`
-   **一致性**: 所有表格统一行高、字号、padding；弹窗 Dialog 使用 `rounded-3xl`
-   **批量操作反馈**: 「批量套用」成功后绿色对勾图标 + 行背景短暂泛绿渐变消失

## 7. Image Direction (图片与视觉资产)

-   **Image Role**: 无强制图片需求，优先通过排版、色彩和局部图形建立视觉记忆点。
-   **Image Avoidance**: 禁止通用科技感插图、商务人物素材；以数据与结构为核心

## 8. 应避免 (Anti-patterns)

-   ❌ 锐利小圆角 (≤4px) — 违背暖调精致定位，弱化人文关怀
-   ❌ 冷色基调（蓝色/灰蓝主色）— 与暖调精致风格冲突
-   ❌ 表格行高 > 48px 或使用斑马纹 — 降低信息密度
-   ❌ 硬编码颜色值 — 必须使用语义 token (bg-primary / text-foreground 等)
