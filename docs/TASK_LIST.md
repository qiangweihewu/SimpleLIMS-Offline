# SimpleLIMS-Offline 具体任务清单

## Phase 1: 基础架构搭建

### 1.1 开发环境配置
- [ ] **TASK-001**: 安装 Electron + Vite + React 项目模板
- [ ] **TASK-002**: 配置 TypeScript 严格模式
- [ ] **TASK-003**: 配置 Tailwind CSS
- [ ] **TASK-004**: 配置 ESLint + Prettier
- [ ] **TASK-005**: 设置 Electron 主进程/渲染进程通信 (IPC)

### 1.2 UI 组件迁移
- [ ] **TASK-006**: 迁移 `src/components/ui/*` 基础组件 (Button, Input, Card, Dialog 等)
- [ ] **TASK-007**: 迁移 `src/lib/utils.ts` 工具函数
- [ ] **TASK-008**: 迁移 `tailwind.config.js` 设计系统
- [ ] **TASK-009**: 迁移通用 Hooks (`use-toast` 等)
- [ ] **TASK-010**: 移除所有 Supabase 相关代码

### 1.3 数据库搭建
- [ ] **TASK-011**: 安装 better-sqlite3
- [ ] **TASK-012**: 配置 SQLite WAL 模式
- [ ] **TASK-013**: 选择并配置 ORM (Drizzle/Prisma)
- [ ] **TASK-014**: 创建数据库初始化脚本

### 1.4 核心数据模型设计
- [ ] **TASK-015**: 设计 `Patient` 表 (id, name, gender, dob, phone, created_at)
- [ ] **TASK-016**: 设计 `TestPanel` 表 (id, code, name, category, ref_range_male, ref_range_female, unit)
- [ ] **TASK-017**: 设计 `Sample` 表 (id, patient_id, sample_type, collected_at, status)
- [ ] **TASK-018**: 设计 `Order` 表 (id, sample_id, test_panel_id, ordered_at, status)
- [ ] **TASK-019**: 设计 `Result` 表 (id, order_id, value, unit, flag, verified_by, verified_at)
- [ ] **TASK-020**: 设计 `Instrument` 表 (id, name, model, connection_type, port, protocol, status)
- [ ] **TASK-021**: 设计 `User` 表 (id, username, password_hash, role, created_at)
- [ ] **TASK-022**: 设计 `AuditLog` 表 (id, user_id, action, entity, entity_id, timestamp)
- [ ] **TASK-023**: 创建数据库 Migration 脚本

---

## Phase 2: 核心业务流程 MVP

### 2.1 患者管理
- [ ] **TASK-024**: 创建 `PatientListPage` 患者列表页面
- [ ] **TASK-025**: 实现患者搜索 (按姓名/ID)
- [ ] **TASK-026**: 创建 `PatientForm` 新增/编辑患者表单
- [ ] **TASK-027**: 实现患者 CRUD API (Service 层)
- [ ] **TASK-028**: 创建 `PatientDetailPage` 患者详情 (含历史检验记录)

### 2.2 检验项目目录
- [ ] **TASK-029**: 创建 `TestCatalogPage` 检验项目列表
- [ ] **TASK-030**: 预置常见检验项目 (CBC, CMP, Lipid Panel, HbA1c, Urinalysis)
- [ ] **TASK-031**: 创建 `TestPanelForm` 新增/编辑检验项目
- [ ] **TASK-032**: 实现参考范围配置 (按性别/年龄)
- [ ] **TASK-033**: 实现检验套餐 (Panel) 功能 (如: 肝功能全套)

### 2.3 样本与开单
- [ ] **TASK-034**: 创建 `NewOrderPage` 开单页面
- [ ] **TASK-035**: 实现患者快速搜索/选择
- [ ] **TASK-036**: 实现检验项目多选
- [ ] **TASK-037**: 生成唯一 Sample ID (日期+流水号)
- [ ] **TASK-038**: 实现条码标签打印 (可选)
- [ ] **TASK-039**: 创建 `OrderListPage` 订单列表 (待检/已完成)

### 2.4 结果录入与审核
- [ ] **TASK-040**: 创建 `ResultEntryPage` 结果录入页面
- [ ] **TASK-041**: 实现手动结果录入表单
- [ ] **TASK-042**: 实现参考范围自动比对
- [ ] **TASK-043**: 实现异常值高亮标记 (H/L/Critical)
- [ ] **TASK-044**: 实现危急值弹窗确认
- [ ] **TASK-045**: 实现结果审核/签发功能
- [ ] **TASK-046**: 创建 `WorklistPage` 工作清单 (按部门/仪器分组)

### 2.5 报告生成
- [ ] **TASK-047**: 设计报告模板 (HTML/CSS)
- [ ] **TASK-048**: 集成 PDF 生成库 (electron-pdf, puppeteer)
- [ ] **TASK-049**: 实现报告页眉 (实验室 Logo + 信息)
- [ ] **TASK-050**: 实现报告正文 (患者信息 + 检验结果表格)
- [ ] **TASK-051**: 实现报告页脚 (合规免责声明)
- [ ] **TASK-052**: 实现报告打印功能
- [ ] **TASK-053**: 实现报告导出 PDF 功能

### 2.6 异常数据池
- [ ] **TASK-054**: 创建 `UnmatchedDataPage` 异常数据池页面
- [ ] **TASK-055**: 实现仪器数据手工认领 (匹配到患者/样本)
- [ ] **TASK-056**: 实现数据丢弃功能 (附原因记录)

---

## Phase 3: 仪器中间件引擎

### 3.1 通讯服务架构
- [ ] **TASK-057**: 创建 `InstrumentService` 主服务类
- [ ] **TASK-058**: 实现串口管理 (枚举/打开/关闭/监听)
- [ ] **TASK-059**: 实现 TCP 客户端/服务器模式
- [ ] **TASK-060**: 实现文件夹监听 (chokidar)
- [ ] **TASK-061**: 实现通讯状态事件 (连接/断开/错误)
- [ ] **TASK-062**: 实现自动重连机制

### 3.2 ASTM 协议解析
- [ ] **TASK-063**: 实现 ASTM E1381 低层协议状态机
  - ENQ/ACK/NAK/EOT 握手
  - Frame 接收与校验和验证
- [ ] **TASK-064**: 实现 ASTM E1394 高层数据解析
  - H (Header) 记录解析
  - P (Patient) 记录解析
  - O (Order) 记录解析
  - R (Result) 记录解析 (核心)
  - L (Terminator) 记录解析
- [ ] **TASK-065**: 实现校验和 (Checksum) 计算与验证
- [ ] **TASK-066**: 实现直方图数据过滤 (丢弃大体积 BLOB)

### 3.3 HL7 v2.x 解析
- [ ] **TASK-067**: 集成 node-hl7-server 或 node-hl7-client
- [ ] **TASK-068**: 实现 ORU^R01 (结果消息) 解析
- [ ] **TASK-069**: 实现 OBX 段 (结果项) 提取
- [ ] **TASK-070**: 实现容错处理 (畸形消息不崩溃)

### 3.4 CSV/文本解析
- [ ] **TASK-071**: 实现通用 CSV 解析器
- [ ] **TASK-072**: 实现列映射配置界面
- [ ] **TASK-073**: 实现已处理文件移动/归档

### 3.5 驱动库架构
- [ ] **TASK-074**: 设计驱动配置 JSON Schema
  ```json
  {
    "name": "Sysmex XP-100",
    "protocol": "ASTM",
    "connection": "RS232",
    "baudRate": 9600,
    "dataBits": 8,
    "stopBits": 1,
    "parity": "none",
    "testMapping": {
      "WBC": "white_blood_cell",
      "RBC": "red_blood_cell"
    }
  }
  ```
- [ ] **TASK-075**: 创建 `InstrumentDriverManager` 驱动加载器
- [ ] **TASK-076**: 创建 `InstrumentSetupWizard` 仪器配置向导

### 3.6 第一批仪器驱动
- [ ] **TASK-077**: Sysmex XP-100 驱动
- [ ] **TASK-078**: Sysmex KX-21 驱动
- [ ] **TASK-079**: Mindray BC-2800 驱动
- [ ] **TASK-080**: Mindray BC-3000 Plus 驱动
- [ ] **TASK-081**: Urit 3000 系列驱动 (通用)
- [ ] **TASK-082**: Rayto 7600 系列驱动 (通用)

### 3.7 数据匹配与入库
- [ ] **TASK-083**: 实现 Sample ID 自动匹配逻辑
- [ ] **TASK-084**: 实现匹配失败 -> 异常数据池
- [ ] **TASK-085**: 实现数据自动写入 Result 表
- [ ] **TASK-086**: 实现 UI 实时刷新 (IPC 通知)

### 3.8 仪器管理界面
- [ ] **TASK-087**: 创建 `InstrumentListPage` 仪器列表
- [ ] **TASK-088**: 创建 `InstrumentForm` 新增/编辑仪器
- [ ] **TASK-089**: 实现仪器连接状态显示 (在线/离线)
- [ ] **TASK-090**: 实现手动测试连接按钮
- [ ] **TASK-091**: 创建 `TestMappingEditor` 测试代码映射编辑器

---

## Phase 4: 数据安全与稳定性

### 4.1 数据库加密
- [ ] **TASK-092**: 集成 SQLCipher (或 better-sqlite3-sqlcipher)
- [ ] **TASK-093**: 实现首次启动设置主密码
- [ ] **TASK-094**: 使用 Electron safeStorage 存储密钥
- [ ] **TASK-095**: 实现数据库解锁流程

### 4.2 用户与权限
- [ ] **TASK-096**: 创建 `LoginPage` 登录页面
- [ ] **TASK-097**: 实现密码 bcrypt 加密存储
- [ ] **TASK-098**: 实现角色定义 (Admin / Technician / Viewer)
- [ ] **TASK-099**: 实现权限守卫 (路由级别)
- [ ] **TASK-100**: 创建 `UserManagementPage` 用户管理 (仅 Admin)

### 4.3 备份与恢复
- [ ] **TASK-101**: 实现一键备份 (导出加密 .db 文件)
- [ ] **TASK-102**: 实现备份到指定路径 (U盘/网络驱动器)
- [ ] **TASK-103**: 实现一键恢复 (导入 .db 文件)
- [ ] **TASK-104**: 实现自动定时备份 (可配置)

### 4.4 审计日志
- [ ] **TASK-105**: 实现关键操作记录 (登录/结果审核/报告发布)
- [ ] **TASK-106**: 创建 `AuditLogPage` 审计日志查看页面
- [ ] **TASK-107**: 实现日志导出 (CSV)

### 4.5 稳定性与性能
- [ ] **TASK-108**: 实现断电恢复 (WAL checkpoint)
- [ ] **TASK-109**: 实现串口断线自动重连
- [ ] **TASK-110**: 实现 UI 渐进加载 (大数据量)
- [ ] **TASK-111**: 低配硬件性能测试与优化 (目标: 2GB RAM)

---

## Phase 5: 打包与激活

### 5.1 应用打包
- [ ] **TASK-112**: 配置 electron-builder
- [ ] **TASK-113**: 生成 Windows .exe 安装包 (NSIS)
- [ ] **TASK-114**: 生成 Mac .dmg 安装包
- [ ] **TASK-115**: 配置应用图标与元数据
- [ ] **TASK-116**: 配置自动更新 (可选, 需网络)

### 5.2 离线激活
- [ ] **TASK-117**: 实现硬件指纹生成 (主板ID + CPU ID + 硬盘ID)
- [ ] **TASK-118**: 实现 Machine ID 显示界面
- [ ] **TASK-119**: 实现 License Key 输入界面
- [ ] **TASK-120**: 实现 RSA 签名验证 (公钥内置)
- [ ] **TASK-121**: 实现激活状态持久化
- [ ] **TASK-122**: 实现试用期模式 (30天)

### 5.3 首次配置向导
- [ ] **TASK-123**: 实现首次启动向导 (语言/实验室信息/Logo上传)
- [ ] **TASK-124**: 实现管理员账户创建
- [ ] **TASK-125**: 实现仪器快速配置引导

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
