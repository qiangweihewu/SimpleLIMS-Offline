# SimpleLIMS-Offline: 项目开发计划书

## 1. 项目愿景 (Vision)
打造一款 **"反主流、极简主义"** 的临床实验室管理系统 (LIMS)。
专为 **发展中国家**、**网络不稳定地区** 的小型临床实验室设计。
核心理念是 **离线优先 (Offline First)**、**即插即用 (Plug & Play)** 和 **仪器自动化 (Automation)**。

## 2. 核心痛点与解决方案 (Problem & Solution)

| 用户痛点 (Pain Points) | 我们的解决方案 (Our Solution) |
| :--- | :--- |
| **网络差**：无法使用主流 Cloud/SaaS LIMS。 | **完全离线架构**：本地数据库 (SQLite)，无网也能飞速运行。 |
| **手工录入累**：每天手动输入几百个血常规数据，易出错。 | **仪器中间件 (MiddleWare)**：内置 HL7/ASTM/CSV 解析引擎，自动从分析仪抓取数据。 |
| **竞品难用**：开源方案 (Senaite) 配置极其复杂；本地软件界面丑陋。 | **消费级 UI/UX**：复用 SimpleLabOS 的现代化界面，极低的学习成本。 |
| **预算低**：无法承担高昂的订阅费。 | **买断制/License模式**：一次性付费或低价年付 Key，无需持续云服务成本。 |

## 3. 技术架构 (Tech Stack)

本项目将基于 **SimpleLabOS** 的前端资产进行 **"Fork & Detach"** 重构。

*   **Runtime**: **Electron** (主选) 或 Tauri。允许访问操作系统底层（文件系统、串口）。
*   **Frontend**: **React** + **TypeScript** + **Tailwind CSS** (复用现有组件库)。
*   **Backend (Local)**:
    *   **App Logic**: Electron IPC (Main Process).
    *   **Database**: **Better-SQLite3** (单文件数据库，易于备份和迁移)。
    *   **ORM**: Drizzle ORM 或 Prisma (针对 SQLite)。
    *   **DB 并发**: 启用 SQLite **WAL** 模式以支持后台写入与前端读取并发。
*   **Connectivity**:
    *   `node-serialport`: 用于 RS232 串口通讯。
    *   `chokidar`: 用于监听仪器输出文件夹 (CSV/XML)。
    *   `net`: 用于 TCP/IP (HL7 over LAN)。
*   **Runtime 运行模型**:
    *   **主进程后台常驻**（系统托盘）：监听仪器数据，UI 关闭仍可采集。
    *   **渲染进程**：只负责数据展示与操作。
    *   **安全存储**：使用系统凭据存储（Windows Credential Manager / macOS Keychain）保存数据库密钥。

## 4. 运行环境与硬件兼容 (Field Reality)

*   **低配硬件**：兼容 Windows 7/低配 PC（2-4GB 内存）。
*   **串口适配器**：优先推荐 **FTDI 芯片**，提供常见驱动包。
*   **线序兼容**：明确支持 **Null Modem** 交叉线（提供线序图/配件选型）。
*   **断电容错**：保证断电恢复后数据一致性与自动重连。

## 5. 仪器驱动库与兼容策略 (Driver Library)

*   **内置驱动库**：优先覆盖常见低端机型（Mindray BC 系列、Sysmex XP 系列、Urit、Rayto、Snibe）。
*   **驱动参数模板**：预置波特率、校验位、停止位、流控、字符集。
*   **映射器**：支持仪器私有代码与 LIMS 测试项目的可配置映射表。
*   **过滤策略**：默认丢弃直方图等大体积数据，避免数据库膨胀。
*   **单向通讯优先**：先保证结果自动入库，再逐步支持双向查询。

## 6. 产品范围与合规边界 (Scope & Compliance)

### 我们做什么 (✅ 行政支持)
*   **自动采集**并**忠实记录**仪器输出的数值结果。
*   将结果与**参考范围**比对并高亮异常值。
*   **生成**格式统一的报告与归档记录。
*   提供历史查询与趋势可视化（用于管理与复核）。

### 我们不做什么 (❌ 临床诊断)
*   不提供诊断建议、风险评分或治疗方案。
*   不自动向医生/患者发送未经审核的报告。
*   不进行 AI 预测或临床决策辅助。

### 合规与信任
*   **离线优先**：数据完全本地存储。
*   **静态加密**：本地数据库文件需加密（SQLCipher）。
*   **访问控制**：登录与角色权限。
*   **备份恢复**：一键备份/还原。

## 7. MVP 功能列表 (Minimum Viable Product)

### I. 实验室核心流 (Core Workflow)
1.  **Patient Registration**: 登记患者基本信息 (姓名, 年龄, 性别, ID)。
2.  **Order Entry**: 开单 (选择检验项目，如 CBC, Lipid Profile)。
3.  **Result Entry**:
    *   *Auto*: 仪器数据自动填充。
    *   *Manual*: 手动补录或修改。
4.  **Reporting**: 生成 PDF 报告，包含：
    *   患者信息 & 实验室抬头。
    *   检验结果 vs **参考范围 (Reference Ranges)** (通过/偏高/偏低 高亮显示)。
    *   审核医生电子签名。
5.  **Worklist**: 生成待检样本清单（按部门/仪器）。
6.  **异常数据池**: 无法匹配 SampleID 的结果进入待认领列表。

### II. 仪器集成/中间件 (Instrument Middleware)
*   支持 **File-based** 集成 (监听共享文件夹中的 CSV/XML/TXT)。
*   支持 **HL7 v2.x** 解析 (基础接收器)。
*   逐步支持 **ASTM** 解析（优先级高于 HL7）。
*   支持数据映射（仪器测试代码 -> 系统测试项目）。
*   单向通讯为主（Uni-directional），双向为后续增强。

### III. 数据管理
*   **Test Catalog**: 预置常见临床检验项目（血常规、尿常规、生化全套）及其参考值。
*   **Backup/Restore**: 一键导出/导入 SQLite 数据库文件。
*   **审计日志**: 关键操作留痕（审核、发布、修订）。

### IV. 体验与激活
*   新手引导式仪器配置向导（即插即用）。
*   离线 License Key 激活（硬件指纹绑定）。
*   UI 低认知负担：极简交互，默认中文+可切换英文。

### V. 临床安全与效率
*   **自动异常标记**（基于参考范围）。
*   **危急值确认弹窗**（必须人工确认）。
*   **TAT 看板**（样本周转时间红黄绿）。

## 8. 开发路线图 (Roadmap)

### Phase 1: 初始化与架构搭建 (Current)
- [x] 创建 `SimpleLIMS-Offline` 仓库。
- [ ] 迁移 SimpleLabOS 通用 UI 组件 (Buttons, Inputs, Cards)。
- [ ] 配置 Electron + Vite + React 开发环境。
- [ ] 搭建 SQLite 本地数据库环境。

### Phase 2: UI 重构与数据模型落地 (MVP 核心)
- [ ] 将 “Cases/CaseDetail” 重构为 **Samples/Results**。
- [ ] 定义核心数据模型：Patient / Sample / TestPanel / ResultItem。
- [ ] 完成样本登记、结果录入、报告输出的最小闭环。
- [ ] 支持 Worklist 与异常数据池。

### Phase 3: 核心业务功能
- [ ] 实现 "Test Catalog" (检验项目) 管理功能。
- [ ] 实现 "Patients" (患者) CRUD。
- [ ] 实现 "Orders" (订单) 流程。

### Phase 4: 仪器连接引擎 (The Killer Feature)
- [ ] 开发文件监听服务 (Watcher) 与 CSV 解析。
- [ ] 开发 ASTM 解析器（首要支持）。
- [ ] 开发 Node.js HL7 解析脚本（兼容扩展）。
- [ ] 实现数据清洗与自动匹配 (Auto-match by SampleID)。
- [ ] 增加数据映射界面（测试代码 -> 项目）。
- [ ] 支持异常数据池与手工认领流程。
- [ ] 驱动库优先级清单与落地计划（机型/协议/连接方式）。

### Phase 5: 报告、打包与激活
- [ ] PDF 报告生成器 (既然是离线，可能需要本地 PDF 库)。
- [ ] Electron Builder 打包 Windows/Mac 安装包。
- [ ] License Key 验证机制（硬件指纹 + 离线激活）。

### Phase 6: 数据安全与稳定性
- [ ] SQLCipher 加密与本地登录权限。
- [ ] 一键备份与恢复。
- [ ] 审计日志与异常处理。
- [ ] 断电恢复与串口自动重连。
- [ ] 低配硬件性能基线优化。

### Phase 7: 质量控制与合规模块
- [ ] QC 模块（L-J 图、Westgard 规则）。
- [ ] 质控失败锁定审核通道。
- [ ] 合规免责声明与报告页脚固化。

## 9. 复用代码清单 (Migration List)
从 `SimpleLabOS` 迁移以下资产：
*   `src/components/ui/*`: 所有的 Shadcn/Tailwind 基础组件。
*   `src/lib/utils.ts`: 通用工具函数。
*   `tailwind.config.js` & `index.css`: 设计系统与样式变量。
*   `src/hooks/*`: 通用 Hooks (use-toast, etc.)。
*   *排除*: 所有的 Supabase 逻辑、牙科特定页面、云端存储逻辑。

## 10. 驱动库优先级清单 (Driver Priority)

### A. 第一波（ASTM/RS-232，单向通讯）
*   Sysmex XP-100 / KX-21
*   Mindray BC-2800 / BC-3000 Plus
*   Urit 3000 系列
*   Rayto 7600 系列

### A1. 连接与通信模板（默认）
*   连接方式：RS-232 + USB 转串口（优先 FTDI）。
*   线缆类型：Null Modem 交叉线。
*   传输模式：单向（仪器广播结果）。
*   默认参数：9600 bps / 8N1 / 无流控。

### B. 第二波（ASTM/RS-232，单向通讯）
*   Sysmex XP-300 / XT 系列
*   Mindray BC-5000 系列
*   Snibe Maglumi 系列（生化/免疫）

### C. 兼容扩展（HL7/MLLP，TCP/IP）
*   Sysmex XN 系列
*   Roche Cobas e411
*   Abbott Architect 系列

### D. 驱动产出形态
*   每个驱动包含：协议解析器 + 参数模板 + 映射表模板 + 样例数据。
*   驱动升级：允许按年度维护费下发增量更新包。

## 11. 渠道与分发 (Distribution)

*   **渠道合作**：与本地医疗设备经销商/维修商捆绑销售。
*   **Computer Village 模式**：在 IT 集散地建立技术支持合作点。
*   **离线交付**：预装在翻新电脑或随仪器附带安装包。
*   **定价策略**：永久买断 + 年度维护服务（支持/驱动更新）。
*   **激活流程**：Machine ID 通过 WhatsApp/短信提交，离线返回 License Key。
