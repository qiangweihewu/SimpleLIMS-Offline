# Legacy Medical Device Integration Roadmap

> **SimpleLIMS-Offline** 老旧医疗设备集成完整路线图  
> 整合底层技术深度与外部生态广度的统一方案

---

## 0. 设计原则

### 🔴 核心约束：离线优先 (Offline-First)

**SimpleLIMS-Offline 的核心定位是完全离线可用的实验室信息系统。**

| 原则 | 说明 |
|-----|------|
| **离线优先** | 所有核心功能必须在无网络环境下完整运行 |
| **联网可选** | 云同步、远程集成作为增强模块，可选启用 |
| **本地存储** | 数据首先存入本地 SQLite，确保零数据丢失 |
| **边缘计算** | 协议解析、数据标准化在本地完成，不依赖云端 |
| **增量同步** | 网络恢复时仅同步增量数据，节省带宽 |

### 架构模式

```
┌─────────────────────────────────────────────────────────────────┐
│                    [可选] 外部集成层                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  DHIS2   │  │ OpenMRS  │  │  Orthanc │  │ Remote CouchDB   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │             │             │                 │           │
│  ═════╪═════════════╪═════════════╪═════════════════╪═══════════│
│       │        [网络边界 - 可选]    │                 │           │
└───────┼─────────────┼─────────────┼─────────────────┼───────────┘
        ▼             ▼             ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 ★ 核心离线系统 (必须) ★                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │             本地数据持久化层 (SQLite + WAL)                  ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ││
│  │  │ 结果数据 │  │ 患者数据 │  │ 审计日志 │  │ FHIR JSON   │  ││
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │             数据处理层 (本地 Electron Main)                  ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ││
│  │  │ASTM解析  │  │HL7解析   │  │Hex解析   │  │语义映射     │  ││
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │             设备接入层 (本地硬件接口)                        ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ││
│  │  │RS-232    │  │RS-485    │  │TCP/IP    │  │USB/文件监控 │  ││
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 现状分析

### 1.1 已实现能力

| 能力 | 实现文件 | 状态 |
|-----|---------|------|
| RS-232 串口通信 | `electron/services/serial-service.ts` | ✅ 完整 |
| TCP/IP 网络通信 | `electron/services/tcp-service.ts` | ✅ 完整 |
| ASTM E1381/E1394 协议 | `electron/services/astm-parser.ts` | ✅ 完整 |
| HL7 v2.x 解析 | `electron/services/hl7-parser.ts` | ✅ 完整 |
| HL7 TCP/MLLP | `electron/services/hl7-tcp-service.ts` | ✅ 完整 |
| JSON 驱动管理 | `electron/services/instrument-driver-manager.ts` | ✅ 完整 |
| 审计日志 | `electron/services/audit-service.ts` | ✅ 完整 |
| 报告生成 (PDF/Excel/CSV) | `src/services/report-generator.ts` | ✅ 完整 |
| **时间同步服务** | `electron/services/time-sync-service.ts` | ✅ 完整 (Phase 1) |
| **原始流量日志** | `electron/services/traffic-logger.ts` | ✅ 完整 (Phase 1) |
| **数据质量监控** | `electron/services/data-quality-monitor.ts` | ✅ 完整 (Phase 1) |
| **RS-485/Modbus RTU** | `electron/services/rs485-service.ts` | ✅ 完整 (Phase 1) |
| **Hex协议解析** | `electron/services/hex-stream-parser.ts` | ✅ 完整 (Phase 2) |
| **设备生命周期管理** | `electron/services/device-lifecycle-manager.ts` | ✅ 完整 (Phase 2) |
| **预测性维护** | `electron/services/predictive-maintenance-service.ts` | ✅ 完整 (Phase 2) |
| **语义映射(FHIR)** | `electron/services/semantic-mapper.ts` | ✅ 完整 (Phase 3) |

### 1.2 已支持设备驱动

- Sysmex KX-21 (血液分析仪)
- Sysmex XP-100
- Mindray BC-2800 / BC-3000 Plus
- Rayto 7600
- URIT 3000

### 1.3 待解决问题

| 问题类别 | 具体挑战 | 状态 |
|---------|---------|------|
| **时间准确性** | 老旧设备时钟漂移，无NTP同步 | ✅ 已解决 (TimeSyncService) |
| **协议多样性** | 专有二进制协议、Hex流无法用ASTM/HL7解析 | ✅ 已解决 (HexStreamParser) |
| **语义互操作** | 设备字段 → 国际标准(FHIR)缺乏映射层 | ✅ 已解决 (SemanticMapper) |
| **数据安全** | SQLite明文存储敏感医疗数据 | ✅ 已解决 (SQLCipher) |
| **网络韧性** | 已有SQLite离线存储，但缺少可选的云同步能力 | 🔲 待实现 (Phase 4) |
| **设备广度** | 缺少生化仪、监护仪、影像设备支持 | 🔲 待实现 (Phase 5) |
| **外部集成** | 无DHIS2/OpenMRS对接能力（可选功能） | 🔲 待实现 (Phase 4) |
| **接口广度** | 仅RS-232，缺少RS-485总线、GPIB、模拟信号采集 | ✅ RS-485已解决，GPIB待实现 |
| **驱动兼容** | 无Wine容器封装老旧Windows驱动方案 | 🔲 待实现 (Phase 2.5) |
| **数据质量** | 缺少丢包率、完整性实时监控告警 | ✅ 已解决 (DataQualityMonitor) |
| **设备管理** | 缺少设备全生命周期台账（采购/维护/报废） | ✅ 已解决 (DeviceLifecycleManager) |
| **预测维护** | 仅数据采集，无设备健康监测与故障预警 | ✅ 已解决 (PredictiveMaintenanceService) |

---

## 2. 架构设计

### 2.1 分层架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Integration Layer                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  DHIS2   │  │ OpenMRS  │  │  Orthanc │  │ Remote CouchDB   │ │
│  │  Sync    │  │  FHIR    │  │  PACS    │  │ (Cloud/Regional) │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
└───────┼─────────────┼─────────────┼─────────────────┼───────────┘
        │             │             │                 │
┌───────┴─────────────┴─────────────┴─────────────────┴───────────┐
│                    Synchronization Layer                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              PouchDB ←→ CouchDB Replication                 │ │
│  │              (Offline-First, Conflict Resolution)           │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                    Semantic Mapping Layer                        │
│  ┌──────────────────┐      ┌──────────────────────────────────┐ │
│  │  SemanticMapper  │ ───► │  openEHR Archetypes → FHIR R4    │ │
│  └──────────────────┘      └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                    Data Processing Layer                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ ASTM Parser│  │ HL7 Parser │  │ HexStream  │  │ CSV Parser│  │
│  │  (existing)│  │  (existing)│  │   Parser   │  │ (existing)│  │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                    Device Access Layer                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ SerialSvc  │  │  TcpSvc    │  │ FileWatch  │  │ VideoCapt │  │
│  │ (existing) │  │ (existing) │  │ (existing) │  │  (new)    │  │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           TimeSyncService (NTP + Drift Correction)          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                    Security & Persistence Layer                  │
│  ┌────────────────────┐  ┌────────────────────────────────────┐ │
│  │ SQLCipher (AES256) │  │ RawTrafficLogger (Forensic Audit)  │ │
│  └────────────────────┘  └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心新增组件

#### 🟢 离线核心组件 (必须实现)

| 组件 | 职责 | 技术选型 |
|-----|------|---------|
| `TimeSyncService` | 本地时钟校准 + 设备时钟漂移校正 | 系统时钟 + 本地偏移计算 (无需NTP) |
| `HexStreamParser` | 二进制/专有协议解析 | 基于JSON定义的offset/length提取 |
| `SemanticMapper` | 设备数据 → openEHR → FHIR | 双层映射架构，本地执行 |
| `RawTrafficLogger` | 原始字节流取证日志 | 独立表 `device_traffic_log` |
| `RS485Service` | RS-485总线多设备通信 | 扩展 `SerialService` |
| `DataQualityMonitor` | 丢包率/完整性实时监控 | 本地告警机制 |
| `DeviceLifecycleManager` | 设备全生命周期台账 | 采购/维护/报废记录 |
| `PredictiveMaintenanceService` | 设备健康监测与故障预警 | 本地规则引擎 |

#### 🟡 联网增强组件 (可选实现)

| 组件 | 职责 | 技术选型 |
|-----|------|---------|
| `CloudSyncService` | 可选的云端同步 | SQLite增量导出 + HTTP上传 |
| `DHIS2Reporter` | 聚合统计上报 | DHIS2 Web API (联网时) |
| `OpenMRSBridge` | EMR系统对接 | OpenMRS FHIR Module (联网时) |
| `NTPSyncService` | 网络时间同步 | NTP客户端 (联网时增强) |
| `VideoCaptureService` | 模拟视频数字化 | FFMPEG + UVC采集卡 |

---

## 3. 实施路线图

### Phase 1: 底层基础强化 (Weeks 1-2)

**目标**: 确保数据采集的准确性、安全性和可追溯性 (完全离线可用)

#### 1.1 TimeSyncService 本地时间同步服务

```typescript
// electron/services/time-sync-service.ts
interface TimeSyncService {
  // 获取系统时间作为参考 (离线模式)
  getSystemTime(): Date;
  
  // [可选] 从NTP服务器获取原子时间 (联网时增强)
  fetchNtpTime?(): Promise<Date>;
  
  // 计算设备时钟与系统时钟的偏移量(毫秒)
  calculateDeviceDrift(instrumentId: number, deviceTime: Date): number;
  
  // 为设备数据附加校正后的时间戳
  correctTimestamp(deviceTime: Date, instrumentId: number): Date;
  
  // 获取特定设备的历史漂移统计
  getDriftHistory(instrumentId: number): DriftRecord[];
  
  // 手动校准设备时钟偏移 (用户可在UI中设置)
  setManualOffset(instrumentId: number, offsetMs: number): void;
}
```

**实现要点 (离线优先)**:
- 默认使用系统本地时钟作为参考时间
- 可选：联网时使用 `ntp-client` 增强精度
- 为每台设备单独记录时钟漂移系数 (存入 SQLite)
- 支持用户手动输入设备时钟偏移量 (适用于已知时钟不准的老旧设备)
- 在 `serial-service.ts` 的 `handleIncomingData` 中自动附加 `receipt_timestamp`

#### 1.2 RawTrafficLogger 原始流量日志

```sql
-- 新增数据表
CREATE TABLE IF NOT EXISTS device_traffic_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_id INTEGER REFERENCES instruments(id),
  direction TEXT NOT NULL CHECK (direction IN ('rx', 'tx')), -- 接收/发送
  raw_bytes BLOB NOT NULL,        -- 原始字节流
  hex_dump TEXT,                  -- 十六进制可读格式
  receipt_timestamp TEXT NOT NULL, -- 校正后的时间戳
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_traffic_instrument ON device_traffic_log(instrument_id);
CREATE INDEX IF NOT EXISTS idx_traffic_timestamp ON device_traffic_log(receipt_timestamp);
```

**实现要点**:
- 扩展 `audit-service.ts` 或新建 `traffic-logger.ts`
- 在 `SerialService.handleIncomingData` 和 `write` 方法中钩入
- 支持按设备/时间范围查询和导出（用于厂商调试）

#### 1.3 SQLCipher 数据库加密

```typescript
// electron/database/index.ts 修改
import Database from 'better-sqlite3-sqlcipher';

const db = new Database(dbPath);
db.pragma(`key = '${encryptionKey}'`);
db.pragma('cipher_compatibility = 4');
```

**实现要点**:
- 替换 `better-sqlite3` 为 `better-sqlite3-sqlcipher`
- 密钥从硬件ID派生或用户输入
- 首次迁移时自动加密现有数据

#### 1.4 RS-485 总线支持

```typescript
// electron/services/rs485-service.ts (扩展 SerialService)
interface RS485Config extends SerialConfig {
  // RS-485 特有配置
  slaveAddress?: number;          // 从站地址 (Modbus RTU)
  txEnableDelay?: number;         // 发送使能延迟 (ms)
  rxEnableDelay?: number;         // 接收使能延迟 (ms)
  halfDuplex?: boolean;           // 半双工模式
}

class RS485Service extends SerialService {
  // 发送 Modbus RTU 请求
  sendModbusRequest(address: number, functionCode: number, data: Buffer): Promise<Buffer>;
  
  // 轮询多个从站设备
  pollSlaves(addresses: number[], interval: number): void;
}
```

**实现要点**:
- 继承现有 `SerialService`，添加 RS-485 特有逻辑
- 支持 Modbus RTU 协议 (常见于输液泵、监护仪网络)
- 处理 RS-485 半双工切换延迟

#### 1.5 数据质量监控

```typescript
// electron/services/data-quality-monitor.ts
interface DataQualityMetrics {
  instrumentId: number;
  packetLossRate: number;         // 丢包率 (%)
  checksumErrorRate: number;      // 校验和错误率 (%)
  dataCompleteness: number;       // 数据完整性 (%)
  lastUpdate: Date;
}

class DataQualityMonitor {
  // 实时统计数据质量
  updateMetrics(instrumentId: number, success: boolean, hasChecksumError: boolean): void;
  
  // 检查是否触发告警 (丢包率 > 0.5%)
  checkAlertThreshold(instrumentId: number): boolean;
  
  // 获取质量报告
  getReport(instrumentId: number, hours: number): DataQualityMetrics;
}
```

#### 1.6 Phase 1 交付物

- [ ] `electron/services/time-sync-service.ts` (离线优先)
- [ ] `device_traffic_log` 表 + 迁移脚本
- [ ] SQLCipher 集成 + 加密密钥管理
- [ ] `electron/services/rs485-service.ts`
- [ ] `electron/services/data-quality-monitor.ts`
- [ ] 单元测试: 时钟漂移校正、数据质量监控验证

---

### Phase 2: 协议扩展与设备广度 (Weeks 3-4)

**目标**: 支持更多设备类型和专有协议

#### 2.1 HexStreamParser 二进制协议解析器

```typescript
// electron/services/hex-stream-parser.ts

interface HexFieldDefinition {
  name: string;           // 字段名 (e.g., "WBC")
  offset: number;         // 起始字节偏移
  length: number;         // 字节长度
  type: 'uint8' | 'uint16_le' | 'uint16_be' | 'int16_le' | 'float32_le' | 'bcd' | 'ascii';
  scale?: number;         // 缩放因子 (e.g., 0.01)
  unit?: string;          // 单位
  bitmask?: number;       // 位掩码提取
}

interface HexProtocolDefinition {
  id: string;
  name: string;
  startMarker?: number[]; // 帧起始标记 (e.g., [0x02, 0x00])
  endMarker?: number[];   // 帧结束标记
  checksumType?: 'xor' | 'sum8' | 'crc16';
  checksumOffset?: number;
  fields: HexFieldDefinition[];
}

class HexStreamParser {
  constructor(definition: HexProtocolDefinition);
  
  // 解析完整帧
  parse(buffer: Buffer): ParsedResult;
  
  // 验证校验和
  validateChecksum(buffer: Buffer): boolean;
  
  // 从流中提取帧
  extractFrames(stream: Buffer): Buffer[];
}
```

**示例驱动配置** (Mindray专有Hex协议):

```json
// electron/drivers/mindray-pm9000-hex.json
{
  "id": "mindray-pm9000-hex",
  "name": "Mindray PM-9000 (Hex Protocol)",
  "protocol": "hex",
  "hexDefinition": {
    "startMarker": [2, 0],
    "endMarker": [3],
    "checksumType": "xor",
    "fields": [
      { "name": "HR", "offset": 4, "length": 2, "type": "uint16_le", "unit": "bpm" },
      { "name": "SpO2", "offset": 6, "length": 1, "type": "uint8", "unit": "%" },
      { "name": "NIBP_SYS", "offset": 8, "length": 2, "type": "uint16_le", "unit": "mmHg" },
      { "name": "NIBP_DIA", "offset": 10, "length": 2, "type": "uint16_le", "unit": "mmHg" }
    ]
  }
}
```

#### 2.2 扩展设备驱动库

| 优先级 | 设备 | 类别 | 协议 |
|-------|-----|------|------|
| 🔴 高 | Roche Cobas c111 | 生化分析仪 | ASTM (双向) |
| 🔴 高 | Human HumaStar 100/200 | 生化分析仪 | ASTM |
| 🔴 高 | Beckman Coulter AcT 5diff | 血液分析仪 | ASTM / Print Dump |
| 🟠 中 | GE Dash 2500/3000 | 患者监护仪 | Datex-Ohmeda (ASCII) |
| 🟠 中 | Philips IntelliVue MP20/30 | 患者监护仪 | MIB (专有) |
| 🟡 低 | Sysmex XS-800i | 血液分析仪 | ASTM |

#### 2.3 GPIB/LPT 旧接口适配

```typescript
// electron/services/legacy-adapter-service.ts

/**
 * 将 GPIB/LPT 设备通过 USB 桥接器映射为虚拟串口
 * 支持的桥接器: Prologix GPIB-USB, StarTech LPT-USB
 */
class LegacyAdapterService {
  // 检测已连接的桥接器
  detectBridges(): Promise<BridgeDevice[]>;
  
  // 将桥接器注册为虚拟串口供 SerialService 使用
  registerAsVirtualPort(bridge: BridgeDevice): string; // 返回虚拟路径如 "BRIDGE:GPIB0"
}
```

#### 2.4 设备全生命周期台账

```sql
-- 新增设备管理表
CREATE TABLE IF NOT EXISTS device_lifecycle (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_id INTEGER REFERENCES instruments(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('purchase', 'install', 'calibration', 'maintenance', 'repair', 'upgrade', 'decommission')),
  event_date TEXT NOT NULL,
  description TEXT,
  cost REAL,                       -- 费用
  performed_by TEXT,               -- 执行人
  next_due_date TEXT,              -- 下次到期日 (如校准到期)
  attachments TEXT,                -- 附件路径 (JSON数组)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_instrument ON device_lifecycle(instrument_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_event_type ON device_lifecycle(event_type);
```

```typescript
// electron/services/device-lifecycle-manager.ts
class DeviceLifecycleManager {
  // 记录生命周期事件
  recordEvent(instrumentId: number, event: LifecycleEvent): Promise<void>;
  
  // 获取设备完整历史
  getHistory(instrumentId: number): Promise<LifecycleEvent[]>;
  
  // 检查即将到期的校准/维护
  getUpcomingDueDates(days: number): Promise<DueReminder[]>;
  
  // 计算设备总拥有成本 (TCO)
  calculateTCO(instrumentId: number): Promise<number>;
  
  // 生成合规报告 (年度校准率等)
  generateComplianceReport(year: number): Promise<ComplianceReport>;
}
```

#### 2.5 预测性维护 (本地规则引擎)

```typescript
// electron/services/predictive-maintenance-service.ts
interface MaintenanceRule {
  id: string;
  instrumentType: string;          // 设备类型
  condition: string;               // 触发条件 (如 "errorRate > 0.05")
  action: 'alert' | 'schedule_maintenance' | 'disable';
  message: string;
}

class PredictiveMaintenanceService {
  // 加载维护规则
  loadRules(): Promise<MaintenanceRule[]>;
  
  // 评估设备健康状态
  evaluateHealth(instrumentId: number): Promise<HealthStatus>;
  
  // 检查维护规则触发
  checkRules(instrumentId: number): Promise<TriggeredRule[]>;
  
  // 预测故障 (基于历史错误率趋势)
  predictFailure(instrumentId: number, days: number): Promise<FailurePrediction>;
}
```

#### 2.6 Phase 2 交付物

- [ ] `electron/services/hex-stream-parser.ts`
- [ ] 扩展 `instrument-driver-manager.ts` 支持 `protocol: "hex"`
- [ ] 新驱动文件: `roche-cobas-c111.json`, `human-humastar.json`, `beckman-act5diff.json`
- [ ] 新驱动文件: `ge-dash.json`, `philips-intellivue.json`
- [ ] `electron/services/legacy-adapter-service.ts`
- [ ] `device_lifecycle` 表 + 迁移脚本
- [ ] `electron/services/device-lifecycle-manager.ts`
- [ ] `electron/services/predictive-maintenance-service.ts`
- [ ] 集成测试: 使用 socat 模拟 Hex 数据流

---

### Phase 3: 语义互操作层 (Weeks 5-6)

**目标**: 建立设备数据到国际标准的双层映射

#### 3.1 SemanticMapper 语义映射器

```typescript
// electron/services/semantic-mapper.ts

/**
 * 双层映射架构:
 * Layer 1: Device Raw → openEHR Archetype (标准化中间格式)
 * Layer 2: openEHR Archetype → FHIR Resource (外部交换格式)
 */

interface ArchetypeMapping {
  archetypeId: string;          // e.g., "openEHR-EHR-OBSERVATION.laboratory_test_result.v1"
  deviceField: string;          // 设备原始字段名
  archetypePath: string;        // openEHR路径 e.g., "/data/events/data/items[at0001]/value"
  transform?: (value: any) => any; // 可选的值转换函数
}

interface FhirMapping {
  archetypeId: string;
  fhirResourceType: 'Observation' | 'DiagnosticReport' | 'Specimen';
  fhirPath: string;             // FHIR路径 e.g., "valueQuantity.value"
  coding?: {                    // LOINC/SNOMED编码
    system: string;
    code: string;
    display: string;
  };
}

class SemanticMapper {
  // 设备数据 → openEHR
  toArchetype(deviceData: Record<string, any>, instrumentId: number): ArchetypeDocument;
  
  // openEHR → FHIR
  toFhir(archetype: ArchetypeDocument): FhirResource;
  
  // 一步到位: 设备 → FHIR
  deviceToFhir(deviceData: Record<string, any>, instrumentId: number): FhirResource;
}
```

#### 3.2 预定义 Archetype 模板

```json
// electron/archetypes/hemogram.archetype.json
{
  "archetypeId": "openEHR-EHR-OBSERVATION.laboratory_test_result-blood_count.v1",
  "name": "Complete Blood Count",
  "mappings": [
    {
      "deviceFields": ["WBC", "白细胞"],
      "path": "/data/events/data/items[at0078.1]/value",
      "fhir": {
        "path": "component[0].valueQuantity",
        "coding": { "system": "http://loinc.org", "code": "6690-2", "display": "WBC" }
      }
    },
    {
      "deviceFields": ["RBC", "红细胞"],
      "path": "/data/events/data/items[at0078.2]/value",
      "fhir": {
        "path": "component[1].valueQuantity",
        "coding": { "system": "http://loinc.org", "code": "789-8", "display": "RBC" }
      }
    }
  ]
}
```

#### 3.3 数据库 FHIR 存储扩展

```sql
-- 在 results 表增加 FHIR 列
ALTER TABLE results ADD COLUMN fhir_observation TEXT; -- JSON blob

-- 或新建独立表
CREATE TABLE IF NOT EXISTS fhir_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL UNIQUE, -- FHIR Resource ID
  resource_json TEXT NOT NULL,      -- 完整 FHIR JSON
  source_result_id INTEGER REFERENCES results(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT                    -- 同步到外部系统的时间
);
```

#### 3.4 Phase 3 交付物

- [ ] `electron/services/semantic-mapper.ts`
- [ ] `electron/archetypes/` 目录 + 基础模板 (hemogram, blood-pressure, glucose)
- [ ] 数据库迁移: `fhir_resources` 表
- [ ] LOINC 代码映射配置文件
- [ ] 单元测试: 设备数据 → FHIR Observation 转换验证

---

### Phase 4: 外部系统集成 (Weeks 7-8) [可选模块]

**目标**: 为有联网条件的用户提供云同步和外部系统集成能力

> ⚠️ **注意**: 本阶段所有功能均为**可选增强**，核心系统在 Phase 1-3 完成后即可完全离线使用。

#### 4.1 云同步服务 (可选)

```typescript
// electron/services/cloud-sync-service.ts

interface CloudSyncConfig {
  enabled: boolean;                // 是否启用云同步
  serverUrl?: string;              // 远程服务器 URL (可选)
  syncInterval?: number;           // 同步间隔 (分钟)
  syncOnStartup?: boolean;         // 启动时同步
  conflictResolution: 'manual' | 'local_wins' | 'remote_wins';
}

class CloudSyncService {
  private config: CloudSyncConfig;
  
  constructor() {
    // 默认禁用，用户需手动启用
    this.config = { enabled: false, conflictResolution: 'manual' };
  }

  // 检查是否启用云同步
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.serverUrl;
  }

  // 手动触发同步 (用户点击按钮)
  async manualSync(): Promise<SyncResult> {
    if (!this.isEnabled()) {
      return { success: false, message: '云同步未启用' };
    }
    return this.performSync();
  }

  // 导出增量数据包 (离线传输用)
  async exportIncrementalPackage(since: Date): Promise<string> {
    // 导出为加密 ZIP 文件，可用 U 盘传输
    const data = await this.getChangesSince(since);
    return this.createEncryptedPackage(data);
  }

  // 导入数据包 (从其他站点)
  async importPackage(filePath: string): Promise<ImportResult> {
    // 支持离线数据交换
    const data = await this.decryptPackage(filePath);
    return this.mergeData(data);
  }

  // 冲突解决 (医疗数据不允许静默覆盖)
  private async handleConflict(conflict: DataConflict): Promise<void> {
    // 保留两个版本，标记为冲突，提示管理员人工审核
    await this.saveConflictRecord(conflict);
    this.emit('sync:conflict', conflict);
  }
}
```

**配置界面扩展**:
- 在 SettingsPage 添加 "数据同步" 配置区 (默认折叠/禁用)
- 支持两种同步模式:
  - **在线同步**: 配置服务器 URL、凭据、同步频率
  - **离线包交换**: 导出/导入加密数据包 (适用于无网络环境的多站点场景)
- 显示同步状态指示器 (未启用/已同步/同步中/有冲突)

#### 4.2 DHIS2 聚合上报 (可选)

```typescript
// electron/services/dhis2-reporter.ts

interface DHIS2Config {
  enabled: boolean;          // 是否启用 DHIS2 上报
  baseUrl?: string;          // e.g., "https://play.dhis2.org/40"
  username?: string;
  password?: string;
  orgUnitId?: string;        // 医疗机构组织单元ID
  dataSetId?: string;        // 数据集ID
}

class DHIS2Reporter {
  // 生成每日聚合统计
  generateDailyAggregate(date: Date): AggregateData {
    return {
      malaria_positive: this.countPositive('MALARIA', date),
      hiv_tests_total: this.countTests('HIV', date),
      hiv_positive: this.countPositive('HIV', date),
      // ... 更多指标
    };
  }

  // 上报到DHIS2
  async submitDataValues(aggregate: AggregateData): Promise<void> {
    const payload = {
      dataSet: this.config.dataSetId,
      period: this.formatPeriod(aggregate.date), // e.g., "20260201"
      orgUnit: this.config.orgUnitId,
      dataValues: this.mapToDataValues(aggregate)
    };

    await fetch(`${this.config.baseUrl}/api/dataValueSets`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(this.config.username + ':' + this.config.password)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }
}
```

#### 4.3 OpenMRS FHIR 对接 (可选)

```typescript
// electron/services/openmrs-bridge.ts

interface OpenMRSConfig {
  enabled: boolean;          // 是否启用 OpenMRS 集成
  baseUrl?: string;
  username?: string;
  password?: string;
}

class OpenMRSBridge {
  constructor(private config: OpenMRSConfig) {
    // 默认禁用
  }
  
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.baseUrl;
  }

  // 推送检验结果到OpenMRS
  async pushObservation(fhirObservation: FhirObservation): Promise<void> {
    // OpenMRS FHIR Module endpoint
    const response = await fetch(
      `${this.config.baseUrl}/openmrs/ws/fhir2/R4/Observation`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.getAuthToken()}`,
          'Content-Type': 'application/fhir+json'
        },
        body: JSON.stringify(fhirObservation)
      }
    );
    
    if (!response.ok) {
      throw new OpenMRSError(`Failed to push observation: ${response.status}`);
    }
  }

  // 查询患者 (按ID匹配)
  async findPatient(patientId: string): Promise<FhirPatient | null> {
    const response = await fetch(
      `${this.config.baseUrl}/openmrs/ws/fhir2/R4/Patient?identifier=${patientId}`
    );
    const bundle = await response.json();
    return bundle.entry?.[0]?.resource || null;
  }
}
```

#### 4.4 Phase 4 交付物

- [ ] `electron/services/cloud-sync-service.ts` (可选模块)
- [ ] `electron/services/dhis2-reporter.ts` (可选模块)
- [ ] `electron/services/openmrs-bridge.ts` (可选模块)
- [ ] UI: SettingsPage "数据同步" 配置面板 (默认折叠)
- [ ] UI: 离线数据包导入/导出功能
- [ ] UI: 同步状态指示器组件
- [ ] 集成测试: 与 DHIS2 Demo 服务器对接验证 (需联网)

---

### Phase 5: 影像设备扩展 (Weeks 9-10, 可选)

**目标**: 支持老旧超声/X光设备的模拟视频采集

#### 5.1 VideoCaptureService 视频采集

```typescript
// electron/services/video-capture-service.ts
import ffmpeg from 'fluent-ffmpeg';

class VideoCaptureService {
  // 列出可用的视频采集设备 (UVC摄像头/采集卡)
  async listDevices(): Promise<VideoDevice[]>;

  // 实时预览 (返回MJPEG流URL)
  startPreview(devicePath: string): string;

  // 截取单帧图像
  async captureFrame(devicePath: string, patientId: string): Promise<string> {
    const outputPath = `${this.storagePath}/${patientId}_${Date.now()}.jpg`;
    
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(devicePath)
        .inputFormat('v4l2')
        .frames(1)
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  // 录制视频片段
  async recordClip(devicePath: string, patientId: string, durationSec: number): Promise<string>;
}
```

#### 5.2 DICOM 封装

```typescript
// electron/services/dicom-wrapper.ts
import dcmjs from 'dcmjs';

class DicomWrapper {
  // 将JPEG图像封装为DICOM
  async wrapImage(
    imagePath: string,
    patientInfo: PatientDemographics,
    studyInfo: StudyMetadata
  ): Promise<string> {
    const imageData = await fs.readFile(imagePath);
    
    const dataset = {
      PatientID: patientInfo.patientId,
      PatientName: patientInfo.name,
      PatientBirthDate: patientInfo.birthDate,
      PatientSex: patientInfo.gender,
      StudyDate: studyInfo.date,
      StudyTime: studyInfo.time,
      Modality: 'US', // Ultrasound
      SOPClassUID: '1.2.840.10008.5.1.4.1.1.6.1', // US Image Storage
      // ... 更多必需标签
    };

    const dicomData = dcmjs.data.DicomMessage.createFromDataset(dataset);
    dicomData.addPixelData(imageData);
    
    const outputPath = imagePath.replace('.jpg', '.dcm');
    await fs.writeFile(outputPath, Buffer.from(dicomData.write()));
    
    return outputPath;
  }
}
```

#### 5.3 Orthanc PACS 集成

```typescript
// electron/services/orthanc-service.ts

class OrthancService {
  constructor(private config: { url: string; username?: string; password?: string }) {}

  // 上传DICOM文件到Orthanc
  async uploadDicom(dicomPath: string): Promise<string> {
    const dicomData = await fs.readFile(dicomPath);
    
    const response = await fetch(`${this.config.url}/instances`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: dicomData
    });
    
    const result = await response.json();
    return result.ID; // Orthanc Instance ID
  }

  // 获取Web Viewer链接
  getViewerUrl(instanceId: string): string {
    return `${this.config.url}/app/explorer.html#instance?uuid=${instanceId}`;
  }
}
```

#### 5.4 Phase 5 交付物

- [ ] `electron/services/video-capture-service.ts`
- [ ] `electron/services/dicom-wrapper.ts`
- [ ] `electron/services/orthanc-service.ts`
- [ ] UI: 影像采集页面 (设备选择、预览、截图、患者关联)
- [ ] 文档: 支持的采集卡型号列表

---

## 4. 验证计划

### 4.1 自动化测试

| 阶段 | 测试类型 | 测试内容 |
|-----|---------|---------|
| Phase 1 | 单元 | TimeSyncService 漂移计算精度 |
| Phase 1 | 单元 | SQLCipher 加解密正确性 |
| Phase 2 | 单元 | HexStreamParser 各数据类型解析 |
| Phase 2 | 集成 | 使用 socat 模拟设备数据流 |
| Phase 3 | 单元 | SemanticMapper 设备→FHIR转换 |
| Phase 4 | 集成 | PouchDB 离线/在线切换同步 |
| Phase 4 | E2E | DHIS2 Demo 服务器数据提交 |

### 4.2 手动验证清单

- [ ] 断开网络后持续采集数据，恢复网络后验证同步完整性
- [ ] 模拟时钟漂移设备，验证时间戳校正
- [ ] 使用真实 Sysmex KX-21 验证端到端流程
- [ ] 导出 FHIR Bundle 并用 FHIR Validator 验证合规性
- [ ] 在 2G 网络环境测试 DHIS2 上报可靠性

---

## 5. 依赖与风险

### 5.1 新增依赖

| 包名 | 用途 | 许可证 |
|-----|------|--------|
| `pouchdb` | 离线同步 | Apache-2.0 |
| `better-sqlite3-sqlcipher` | 数据库加密 | MIT |
| `ntp-client` | NTP时间同步 | MIT |
| `fluent-ffmpeg` | 视频处理 | MIT |
| `dcmjs` | DICOM处理 | MIT |

### 5.2 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| SQLCipher迁移导致数据丢失 | 高 | 迁移前强制备份，提供回滚脚本 |
| 二进制协议文档缺失 | 中 | 使用 RawTrafficLogger 逆向分析 |
| 云服务器不可用 | 低 | **离线优先设计，本地数据永远可用，云同步为可选增强** |
| DICOM合规性问题 | 低 | 使用标准库，经过DICOM Validator验证 |
| 老旧设备驱动不兼容 | 中 | 使用 Wine 容器封装 Windows XP 驱动 |
| 设备时钟严重漂移 | 中 | 支持手动配置偏移量 + 接收时间戳自动附加 |
| 网络环境完全离线 | 无 | **核心功能 100% 离线可用，不依赖任何网络服务** |

---

## 6. 里程碑总结

### 核心里程碑 (离线系统完整可用)

| 里程碑 | 完成时间 | 核心交付 | 离线可用 |
|-------|---------|---------|---------|
| M1: 底层基础 | Week 2 | 时间同步 + 流量日志 + 加密 + RS-485 + 数据质量监控 | ✅ 是 |
| M2: 协议扩展 | Week 4 | HexParser + 5个新驱动 + 设备台账 + 预测维护 | ✅ 是 |
| M3: 语义互操作 | Week 6 | SemanticMapper + FHIR存储 | ✅ 是 |

### 增强里程碑 (可选，需联网)

| 里程碑 | 完成时间 | 核心交付 | 离线可用 |
|-------|---------|---------|---------|
| M4: 外部集成 | Week 8 | 云同步 + 离线包交换 + DHIS2 + OpenMRS | ⚡ 部分 |
| M5: 影像支持 | Week 10 | 视频采集 + DICOM + Orthanc | ✅ 是 |

> **说明**: Phase 1-3 完成后，系统即可完全离线使用。Phase 4-5 为增强功能，可根据用户实际需求选择性实施。

---

## 附录

### A. 参考文档

- [发展中国家老旧医疗设备数据管理平台调研报告](./发展中国家老旧医疗设备数据管理平台.md)
- [ASTM E1381/E1394 协议规范](https://www.astm.org/e1381-02r21.html)
- [HL7 FHIR R4 规范](https://hl7.org/fhir/R4/)
- [openEHR Archetype 参考](https://specifications.openehr.org/releases/AM/latest)
- [DHIS2 开发者文档](https://docs.dhis2.org/en/develop/develop.html)
- [OpenMRS FHIR Module](https://wiki.openmrs.org/display/projects/OpenMRS+FHIR+Module)

### B. 文件结构预览

```
electron/
├── services/
│   ├── serial-service.ts              # 现有
│   ├── tcp-service.ts                 # 现有
│   ├── astm-parser.ts                 # 现有
│   ├── hl7-parser.ts                  # 现有
│   │
│   │ # ===== Phase 1: 底层基础 (离线核心) =====
│   ├── time-sync-service.ts           # 时间同步 (离线优先)
│   ├── traffic-logger.ts              # 原始流量日志
│   ├── rs485-service.ts               # RS-485 总线支持
│   ├── data-quality-monitor.ts        # 数据质量监控
│   │
│   │ # ===== Phase 2: 协议扩展 (离线核心) =====
│   ├── hex-stream-parser.ts           # 二进制协议解析
│   ├── legacy-adapter-service.ts      # GPIB/LPT 适配
│   ├── device-lifecycle-manager.ts    # 设备全生命周期台账
│   ├── predictive-maintenance.ts      # 预测性维护
│   │
│   │ # ===== Phase 3: 语义互操作 (离线核心) =====
│   ├── semantic-mapper.ts             # openEHR → FHIR 映射
│   │
│   │ # ===== Phase 4: 外部集成 (可选) =====
│   ├── cloud-sync-service.ts          # 云同步 (可选)
│   ├── dhis2-reporter.ts              # DHIS2 上报 (可选)
│   ├── openmrs-bridge.ts              # OpenMRS 对接 (可选)
│   │
│   │ # ===== Phase 5: 影像扩展 (可选) =====
│   ├── video-capture-service.ts       # 视频采集
│   ├── dicom-wrapper.ts               # DICOM 封装
│   └── orthanc-service.ts             # Orthanc PACS
│
├── drivers/
│   ├── sysmex-kx21.json               # 现有
│   ├── mindray-bc3000plus.json        # 现有
│   ├── roche-cobas-c111.json          # Phase 2 新增
│   ├── human-humastar.json            # Phase 2 新增
│   ├── beckman-act5diff.json          # Phase 2 新增
│   ├── ge-dash.json                   # Phase 2 新增
│   └── philips-intellivue.json        # Phase 2 新增
│
├── archetypes/
│   ├── hemogram.archetype.json        # Phase 3 新增
│   ├── blood-pressure.archetype.json
│   └── glucose.archetype.json
│
└── database/
    └── schema.ts                      # 扩展: fhir_resources, device_traffic_log, device_lifecycle
```

---

## C. 三份调研报告关键发现整合

本路线图整合了以下三份调研报告的核心发现：

### 文档1: 老旧医疗设备数据管理1.md

| 关键发现 | 整合到路线图 |
|---------|-------------|
| 边缘计算网关 (研祥MGP-800) | Phase 1-2 设备接入层设计 |
| Mirth Connect 协议转换 | Phase 3 SemanticMapper |
| 分阶段实施策略 | 5个Phase渐进式路线 |
| 成本效益分析 | 第5.2节风险与缓解 |

### 文档2: 老旧医疗设备数据管理2.md

| 关键发现 | 整合到路线图 |
|---------|-------------|
| RS-485/RS-422 总线接口 | Phase 1 RS485Service |
| IEEE 11073 标准 | Phase 3 语义层设计参考 |
| 预测性维护 | Phase 2 PredictiveMaintenanceService |
| HIPAA/GDPR 合规 | Phase 1 SQLCipher 加密 |
| 消息队列架构 | 本地事件驱动设计 |

### 文档3: 老旧医疗设备数据管理3.md

| 关键发现 | 整合到路线图 |
|---------|-------------|
| 时间戳漂移 ±5-10秒 | Phase 1 TimeSyncService 手动校准 |
| 私有协议逆向工程 | Phase 1 RawTrafficLogger |
| Wine容器封装驱动 | Phase 2 legacy-adapter-service |
| openEHR+FHIR双层建模 | Phase 3 SemanticMapper |
| 设备全生命周期台账 | Phase 2 DeviceLifecycleManager |
| 数据质量监控 (丢包率<0.5%) | Phase 1 DataQualityMonitor |
| 区块链审计 | 考虑但未纳入 (可作为未来扩展) |
| ROI>200% | 成本效益评估参考 |

---

*文档版本: 2.0*  
*创建日期: 2026-02-01*  
*最后更新: 2026-02-01*  
*更新内容: 整合三份调研报告，强化离线优先架构，新增RS-485/数据质量/设备台账/预测维护*
