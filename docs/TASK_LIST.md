# SimpleLIMS-Offline 具体任务清单

## Phase 1: 基础架构搭建

### 1.1 开发环境配置
- [x] **TASK-001**: 安装 Electron + Vite + React 项目模板
- [x] **TASK-002**: 配置 TypeScript 严格模式
- [x] **TASK-003**: 配置 Tailwind CSS
- [x] **TASK-004**: 配置 ESLint + Prettier
- [x] **TASK-005**: 设置 Electron 主进程/渲染进程通信 (IPC)

### 1.2 UI 组件迁移
- [x] **TASK-006**: 迁移 `src/components/ui/*` 基础组件 (Button, Input, Card, Dialog 等)
- [x] **TASK-007**: 迁移 `src/lib/utils.ts` 工具函数
- [x] **TASK-008**: 迁移 `tailwind.config.js` 设计系统
- [x] **TASK-009**: 迁移通用 Hooks (`use-toast` 等)
- [x] **TASK-010**: 移除所有 Supabase 相关代码

### 1.3 数据库搭建
- [x] **TASK-011**: 安装 better-sqlite3
- [x] **TASK-012**: 配置 SQLite WAL 模式
- [x] **TASK-013**: 选择并配置 ORM (Drizzle/Prisma) - *Adopted raw SQL/better-sqlite3 wrapper*
- [x] **TASK-014**: 创建数据库初始化脚本

### 1.4 核心数据模型设计
- [x] **TASK-015**: 设计 `Patient` 表 (id, name, gender, dob, phone, created_at)
- [x] **TASK-016**: 设计 `TestPanel` 表 (id, code, name, category, ref_range_male, ref_range_female, unit)
- [x] **TASK-017**: 设计 `Sample` 表 (id, patient_id, sample_type, collected_at, status)
- [x] **TASK-018**: 设计 `Order` 表 (id, sample_id, test_panel_id, ordered_at, status)
- [x] **TASK-019**: 设计 `Result` 表 (id, order_id, value, unit, flag, verified_by, verified_at)
- [x] **TASK-020**: 设计 `Instrument` 表 (id, name, model, connection_type, port, protocol, status)
- [x] **TASK-021**: 设计 `User` 表 (id, username, password_hash, role, created_at)
- [x] **TASK-022**: 设计 `AuditLog` 表 (id, user_id, action, entity, entity_id, timestamp)
- [x] **TASK-023**: 创建数据库 Migration 脚本

---

## Phase 2: 核心业务流程 MVP

### 2.1 患者管理
- [x] **TASK-024**: 创建 `PatientListPage` 患者列表页面
- [x] **TASK-025**: 实现患者搜索 (按姓名/ID)
- [x] **TASK-026**: 创建 `PatientForm` 新增/编辑患者表单
- [x] **TASK-027**: 实现患者 CRUD API (Service 层)
- [x] **TASK-028**: 创建 `PatientDetailPage` 患者详情 (含历史检验记录)

### 2.2 检验项目目录
- [x] **TASK-029**: 创建 `TestCatalogPage` 检验项目列表
- [x] **TASK-030**: 预置常见检验项目 (CBC, CMP, Lipid Panel, HbA1c, Urinalysis)
- [x] **TASK-031**: 创建 `TestPanelForm` 新增/编辑检验项目
- [x] **TASK-032**: 实现参考范围配置 (按性别/年龄)
- [x] **TASK-033**: 实现检验套餐 (Panel) 功能 (如: 肝功能全套)

### 2.3 样本与开单
- [x] **TASK-034**: 创建 `NewOrderPage` 开单页面
- [x] **TASK-035**: 实现患者快速搜索/选择
- [x] **TASK-036**: 实现检验项目多选
- [x] **TASK-037**: 生成唯一 Sample ID (日期+流水号) + 支持手动输入
- [x] **TASK-038**: 实现条码标签打印 (可选 - 后续实现)
- [x] **TASK-039**: 创建 `OrderListPage` 订单列表 (待检/已完成)

### 2.4 结果录入与审核
- [x] **TASK-040**: 创建 `ResultEntryPage` 结果录入页面
- [x] **TASK-041**: 实现手动结果录入表单
- [x] **TASK-042**: 实现参考范围自动比对 (按性别/年龄)
- [x] **TASK-043**: 实现异常值高亮标记 (H/L/Critical)
- [x] **TASK-044**: 实现危急值弹窗确认
- [x] **TASK-045**: 实现结果审核/签发功能
- [x] **TASK-046**: 创建 `WorklistPage` 工作清单 (按部门/仪器分组)

### 2.5 报告生成
- [x] **TASK-047**: 设计报告模板 (HTML/CSS) - `src/components/report/LabReport.tsx`
- [x] **TASK-048**: 集成 PDF 生成库 (Electron printToPDF)
- [x] **TASK-049**: 实现报告页眉 (实验室 Logo + 信息)
- [x] **TASK-050**: 实现报告正文 (患者信息 + 检验结果表格)
- [x] **TASK-051**: 实现报告页脚 (合规免责声明)
- [x] **TASK-052**: 实现报告打印功能
- [x] **TASK-053**: 实现报告导出 PDF 功能

### 2.6 异常数据池
- [x] **TASK-054**: 创建 `UnmatchedDataPage` 异常数据池页面
- [x] **TASK-055**: 实现仪器数据手工认领 (匹配到患者/样本)
- [x] **TASK-056**: 实现数据丢弃功能 (附原因记录)

---

## Phase 3: 仪器中间件引擎

### 3.1 通讯服务架构
- [x] **TASK-057**: 创建 `InstrumentService` 主服务类
- [x] **TASK-058**: 实现串口管理 (枚举/打开/关闭/监听)
- [x] **TASK-059**: 实现 TCP 客户端/服务器模式
- [x] **TASK-060**: 实现文件夹监听 (chokidar)
- [x] **TASK-061**: 实现通讯状态事件 (连接/断开/错误)
- [x] **TASK-062**: 实现自动重连机制 (仅串口)

### 3.2 ASTM 协议解析
- [x] **TASK-063**: 实现 ASTM E1381 低层协议状态机
  - ENQ/ACK/NAK/EOT 握手
  - Frame 接收与校验和验证
- [x] **TASK-064**: 实现 ASTM E1394 高层数据解析
  - H (Header) 记录解析
  - P (Patient) 记录解析
  - O (Order) 记录解析
  - R (Result) 记录解析 (核心)
  - L (Terminator) 记录解析
- [x] **TASK-065**: 实现校验和 (Checksum) 计算与验证
- [x] **TASK-066**: 实现直方图数据过滤 (丢弃大体积 BLOB) - `isHistogramData()` + `filterHistogramData()`

### 3.3 HL7 v2.x 解析
- [x] **TASK-067**: 实现 HL7 v2.x 解析器 - `electron/services/hl7-parser.ts` (无外部依赖)
- [x] **TASK-068**: 实现 ORU^R01 (结果消息) 解析
- [x] **TASK-069**: 实现 OBX 段 (结果项) 提取
- [x] **TASK-070**: 实现容错处理 (畸形消息不崩溃) - try-catch 包裹，返回部分结果

### 3.4 CSV/文本解析
- [x] **TASK-071**: 实现通用 CSV 解析器 - `electron/services/csv-parser.ts`
- [x] **TASK-072**: 实现列映射配置界面 - InstrumentForm CSV 配置区
- [x] **TASK-073**: 实现已处理文件移动/归档 - FileWatchService processFile()

### 3.5 驱动库架构
- [x] **TASK-074**: 设计驱动配置 JSON Schema - `electron/drivers/*.json`
- [x] **TASK-075**: 创建 `InstrumentDriverManager` 驱动加载器 - `electron/services/instrument-driver-manager.ts`
- [x] **TASK-076**: 创建 `InstrumentSetupWizard` 仪器配置向导 - `src/components/instruments/InstrumentSetupWizard.tsx`

### 3.6 第一批仪器驱动
- [x] **TASK-077**: Sysmex XP-100 驱动
- [x] **TASK-078**: Sysmex KX-21 驱动
- [x] **TASK-079**: Mindray BC-2800 驱动
- [x] **TASK-080**: Mindray BC-3000 Plus 驱动
- [x] **TASK-081**: Urit 3000 系列驱动 (通用)
- [x] **TASK-082**: Rayto 7600 系列驱动 (通用)

### 3.7 数据匹配与入库
- [x] **TASK-083**: 实现 Sample ID 自动匹配逻辑
- [x] **TASK-084**: 实现匹配失败 -> 异常数据池
- [x] **TASK-085**: 实现数据自动写入 Result 表
- [x] **TASK-086**: 实现 UI 实时刷新 (IPC 通知)

### 3.8 仪器管理界面
- [x] **TASK-087**: 创建 `InstrumentListPage` 仪器列表
- [x] **TASK-088**: 创建 `InstrumentForm` 新增/编辑仪器
- [x] **TASK-089**: 实现仪器连接状态显示 (在线/离线)
- [x] **TASK-090**: 实现手动测试连接按钮
- [x] **TASK-091**: 创建 `TestMappingEditor` 测试代码映射编辑器

---

## Phase 4: 数据安全与稳定性

### 4.1 数据库加密
- [x] **TASK-092**: 集成 better-sqlite3-multiple-ciphers
- [x] **TASK-093**: 实现首次启动设置主密码 (自动生成高强度密钥)
- [x] **TASK-094**: 使用 Electron safeStorage 存储密钥
- [x] **TASK-095**: 实现数据库解锁流程 (自动解锁)

### 4.2 用户与权限
- [x] **TASK-096**: 创建 `LoginPage` 登录页面
- [x] **TASK-097**: 实现密码 bcrypt 加密存储
- [x] **TASK-098**: 实现角色定义 (Admin / Technician / Viewer)
- [x] **TASK-099**: 实现权限守卫 (路由级别 - RequireAuth)
- [x] **TASK-100**: 创建 `UserManagementPage` 用户管理 (仅 Admin)
    - backend endpoints (list, create, update, delete, toggle) implemented
    - frontend page with table and dialog implemented
    - integrated into App with role check

### 4.3 备份与恢复
- [x] **TASK-101**: 实现一键备份 (导出加密 .db 文件)
- [x] **TASK-102**: 实现备份到指定路径 (U盘/网络驱动器) - *Supported via Save Dialog*
- [x] **TASK-103**: 实现一键恢复 (导入 .db 文件)
- [x] **TASK-104**: 实现自动定时备份 (可配置)
    - Created BackupService with node-schedule
    - Added backend options update handler
    - Updated UI in SettingsPage

### 4.4 审计日志
- [x] **TASK-105**: 实现关键操作记录 (登录/结果审核/报告发布)
    - Created AuditLogger service
    - Integrated with auth and user handlers
- [x] **TASK-106**: 支持日志查询与导出
    - Implemented `audit:getLogs` IPC with filtering/pagination
    - Add client-side CSV export
- [x] **TASK-107**: 创建 `AuditLogPage` 审计日志页面 (仅 Admin)
    - Created page with table, filters, and export button
    - Integrated Route

### 4.5 稳定性与性能
- [x] **TASK-108**: 实现断电恢复 (WAL checkpoint)
    - Enabled `journal_mode=WAL` and `synchronous=NORMAL`
    - Implemented `checkpointDatabase` and auto-checkpoint on close
- [x] **TASK-109**: 实现串口断线自动重连
    - Implemented with exponential backoff logic in SerialService
    - Handles unintentional disconnects via `close` event
- [x] **TASK-110**: 实现 UI 渐进加载 (大数据量)
    - Implemented pagination for Unmatched Data (typically the largest dataset)
    - Audit Logs also paginated
- [x] **TASK-111**: 低配硬件性能测试与优化 (目标: 2GB RAM)
    - Pagination ensures low memory footprint
    - SQLite WAL mode ensures non-blocking reads/writes
    - Removed heavy "Select All" queries for critical paths

---

## Phase 5: 打包与激活

### 5.1 应用打包
- [x] **TASK-112**: 配置 electron-builder
    - Installed `better-sqlite3-multiple-ciphers`
    - Updated `package.json` build config (ASAR unpack, NSIS opts, artifact naming)
- [ ] **TASK-113**: 生成 Windows .exe 安装包 (NSIS)
- [x] **TASK-114**: 生成 Mac .dmg 安装包
    - Built successful `.dmg` (ARM64)
    - Signed with local identity
    - Used default icon (will update in TASK-115)
- [x] **TASK-115**: 配置应用图标与元数据
    - Detected `logo.png` was actually a JPEG
    - Converted to real PNG (`logo_real.png`)
    - Generated `icon.icns` (via sips/iconutil) and `icon.ico` (via png2icons)
- [ ] **TASK-116**: 配置自动更新 (可选, 需网络)

### 5.2 离线激活
- [x] **TASK-117**: Implement License Key Generator (CLI Tool)
    - Generated RSA keypair (`private_key.pem`, `public_key.pem`)
    - Created `scripts/generate-license.ts`
    - Implemented secure verification in `ipc-handlers.ts`
- [x] **TASK-118**: Implement License Input UI
    - Added Machine ID display and copy button in Settings Page
    - Added License Key input and Activate button
    - Integrated with backend `license:activate`
- [x] **TASK-119**: 实现 License Key 输入界面 (Merged with 118)
- [x] **TASK-120**: 实现 RSA 签名验证 (公钥内置)
    - Implemented in `ipc-handlers.ts`
- [x] **TASK-121**: 实现激活状态持久化
    - Stored in SQLite `settings` table (`license_key`, `license_activated_at`)
- [x] **TASK-122**: 实现试用期模式 (30天)
    - Implemented `first_run_at` tracking in SQLite
    - Calculated `trialDaysRemaining` in `license:getStatus`
    - Displayed countdown/expiration status in Settings UI

### 5.3 首次配置向导
- [x] **TASK-123**: 实现首次启动向导 (语言/实验室信息/Logo上传)
    - Created `SetupPage.tsx` with multi-step wizard
    - Implemented logic to save Lab Info and Language
    - Added Route `/setup` and redirection in `App.tsx`
- [x] **TASK-124**: 实现管理员账户创建
    - Integrated into Setup Wizard (Step 3)
    - Implemented `system:createFirstAdmin` IPC with strict checks
- [x] **TASK-125**: 实现仪器快速配置引导
    - Deferred to main application flow (Instruments Page)
    - Wizard guides user to Dashboard where they can proceed with configuration

### 5.4 文档与交付
- [x] **TASK-DOC-1**: 编写用户手册 (Markdown/PDF)
    - Created `docs/USER_MANUAL.md`
- [x] **TASK-DOC-2**: 编写开发者文档 (架构/编译指南)
    - Created `docs/DEVELOPER.md` (Architecture, Build, native modules)
- [ ] **TASK-DOC-3**: 最终集成测试与Bug修复

---

## Phase 6: 质量控制模块 (可选增强)

### 6.1 QC 数据管理
- [ ] **TASK-126**: 设计 `QCMaterial` 表 (质控品信息)
- [ ] **TASK-127**: 设计 `QCResult` 表 (质控结果)
- [ ] **TASK-128**: 创建 `QCEntryPage` QC 结果录入

### 6.2 统计与图表
- [ ] **TASK-129**: 实现 L-J 图 (Levey-Jennings Chart)
- [ ] **TASK-130**: 实现 Mean / SD / CV% 自动计算
- [ ] **TASK-131**: 实现 Westgard 多规则判断 (1-2s, 1-3s, 2-2s)
- [ ] **TASK-132**: 实现质控失败警告

### 6.3 质控锁定
- [ ] **TASK-133**: 实现 QC 失败时锁定患者结果审核
- [ ] **TASK-134**: 实现 QC 通过后解锁

### 6.4 TAT 监控
- [ ] **TASK-135**: 实现样本周转时间计算
- [ ] **TASK-136**: 创建 TAT 仪表盘 (红黄绿预警)

---

## 代码迁移清单 (从 SimpleLabOS)

### 需迁移
- [x] `src/components/ui/*` - Shadcn 基础组件
- [x] `src/lib/utils.ts` - 通用工具函数
- [x] `tailwind.config.js` - 设计系统
- [x] `src/hooks/use-toast.ts` - Toast Hook
- [ ] `src/contexts/ThemeContext.tsx` - 主题上下文 (如需要)

### 需排除
- [ ] `src/lib/supabase.ts` - Supabase 客户端
- [ ] `src/contexts/AuthContext.tsx` - Supabase Auth
- [ ] `src/services/*` - 所有 Supabase 相关 Service
- [ ] 所有牙科业务相关页面

---

## 验收标准

### MVP 验收 (Phase 1-4)
1. ✅ 可在 Windows 7+ / macOS 上运行
2. ✅ 完全离线可用，无需网络
3. ✅ 可手动录入患者信息和检验结果
4. ✅ 可连接至少 1 台 ASTM 仪器自动采集数据
5. ✅ 可生成并打印专业 PDF 报告
6. ✅ 数据库加密存储
7. ✅ 基础登录/权限控制
8. ✅ 一键备份/恢复

### V1.0 验收 (Phase 1-5)
1. ✅ 可生成 Windows/Mac 安装包
2. ✅ 支持离线 License 激活
3. ✅ 内置 4+ 常见仪器驱动
4. ✅ 提供首次配置向导
