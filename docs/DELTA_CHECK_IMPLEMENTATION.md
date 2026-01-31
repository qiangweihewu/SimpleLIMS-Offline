# Delta Check 实现文档

## 概述

Delta Check 是实验室信息管理系统 (LIMS) 中的高级数据验证功能，用于检测患者测试结果中的剧烈波动。这有助于识别：
- **样本混淆或标签错误** - 患者的结果与历史数据严重不符
- **医疗事件** - 如大出血、器官功能衰竭等导致的急剧变化
- **仪器故障或校准问题**

## 实现细节

### 1. 后端服务 (`src/services/database.service.ts`)

#### `deltaCheckService.getPatientTestHistory()`

```typescript
async getPatientTestHistory(patientId: number, testPanelId: number, limitDays: number = 14)
```

**功能**：获取患者过去N天内某个测试项目的历史数据

**参数**：
- `patientId`: 患者ID
- `testPanelId`: 测试项目ID
- `limitDays`: 查询回溯天数（默认14天）

**返回**：
```typescript
Array<{
  id: number;
  value: string;
  numeric_value: number | null;
  created_at: string;
  flag: string | null;
}>
```

**SQL 查询逻辑**：
- 根据患者ID和测试项目ID在订单表中查找
- 只返回有数值的结果
- 按创建时间降序排列
- 限制14天内的历史记录，最多20条

### 2. Delta Check 算法 (`src/lib/utils.ts`)

#### `performDeltaCheck()`

```typescript
export function performDeltaCheck(
  currentValue: number,
  historyData: Array<{ numeric_value: number; created_at: string }>,
  changeThreshold: number = 30
): DeltaCheckResult
```

**工作流程**：

1. **验证历史数据** - 确保至少有一个历史值
2. **获取最近值** - 取最近一次的测试结果作为对比基准
3. **计算百分比变化**：
   ```
   changePercent = |currentValue - previousValue| / |previousValue| * 100
   ```
4. **判断是否超过阈值** - 默认阈值为30%
5. **返回结果**：
   - `hasDeltaAlert`: 是否触发警告
   - `previousValue`: 前次值
   - `previousDate`: 前次测试日期
   - `changePercent`: 变化百分比
   - `message`: 中文警告消息

**特殊情况处理**：
- 如果前次值为0，不计算百分比变化
- 如果历史数据为空，返回 `hasDeltaAlert: false`

### 3. UI 组件

#### Delta Check 警告对话框 (`src/components/DeltaCheckAlert.tsx`)

**特点**：
- 黄色边框警告框（区别于危急值的红色）
- 显示患者、测试项目、当前值、前次值、变化幅度
- 强制确认复选框
- 仅在勾选后允许确认操作

**Props**：
```typescript
interface DeltaCheckAlertProps {
  open: boolean;
  alert: DeltaAlertData | null;
  onConfirm: (resultId: number) => void;
  onOpenChange: (open: boolean) => void;
}
```

### 4. 集成到结果页面 (`src/pages/ResultsPage.tsx`)

#### 关键流程：

1. **初始化状态**：
   ```typescript
   const [deltaAlertOpen, setDeltaAlertOpen] = useState(false);
   const [currentDeltaAlert, setCurrentDeltaAlert] = useState<DeltaAlertData | null>(null);
   const [unacknowledgedDeltaAlerts, setUnacknowledgedDeltaAlerts] = useState<DeltaAlertData[]>([]);
   ```

2. **本地存储管理**：
   - `ACKNOWLEDGED_DELTA_KEY`: 存储已确认的Delta Check ID
   - 防止重复提醒已确认过的警告

3. **加载Delta Check数据**：
   - 在 `useEffect` 中加载所有未确认的Delta检查
   - 遍历所有待审核结果
   - 并行查询历史数据
   - 执行Delta Check算法
   - 收集需要显示的警告

4. **警告队列管理**：
   - 一次只显示一个警告
   - 用户确认后，自动显示下一个
   - 所有警告确认后，关闭对话框

#### 代码示例：
```typescript
// 加载数据
const history = await deltaCheckService.getPatientTestHistory(
  result.patient_id,
  result.panel_id,
  14 // 14 days lookback
);

// 执行检查
const deltaResult = performDeltaCheck(
  parseFloat(result.value),
  historyForDeltaCheck,
  30 // 30% threshold
);

// 构建警告数据
if (deltaResult.hasDeltaAlert) {
  newDeltaAlerts.push({
    id: result.id,
    testName: t(getDisplayName(result.test_name, result.test_name_en || '', i18n.language)),
    currentValue: result.value,
    previousValue: deltaResult.previousValue,
    previousDate: deltaResult.previousDate,
    changePercent: deltaResult.changePercent || 0,
    patientName: getPatientNameFromObject(result, i18n.language),
    unit: result.unit
  });
}
```

## 数据库更改

### PendingResult 接口扩展

添加了两个必要字段以支持 Delta Check：
```typescript
patient_id: number;    // 患者ID，用于查询历史数据
panel_id: number;      // 测试面板ID，用于查询同一测试的历史结果
```

### SQL 查询更新

在 `resultService.getPending()` 中添加：
```sql
s.patient_id, o.panel_id
```

## 配置参数

### Delta Check 阈值

默认设置为**30% 变化**，可在 `ResultsPage.tsx` 中调整：

```typescript
const deltaResult = performDeltaCheck(
  parseFloat(result.value),
  historyForDeltaCheck,
  30 // 改为其他百分比值
);
```

### 历史数据查询期限

默认为**14天**，可在 `ResultsPage.tsx` 中调整：

```typescript
const history = await deltaCheckService.getPatientTestHistory(
  result.patient_id,
  result.panel_id,
  14 // 改为其他天数
);
```

## 翻译支持

已支持中文和英文，翻译键位置：

### 中文 (`src/locales/zh/translation.json`)
```json
"delta": {
  "alert_title": "Delta Check 警告",
  "message": "检测到该患者检测值的剧烈波动，请核实样本或患者信息",
  "current_value": "当前值",
  "previous_value": "前次值",
  "previous_date": "测试日期",
  "change_percent": "变化幅度",
  "acknowledge": "我已确认此警告"
}
```

### 英文 (`src/locales/en/translation.json`)
```json
"delta": {
  "alert_title": "Delta Check Warning",
  "message": "Significant change detected. Please verify sample or patient information.",
  "current_value": "Current Value",
  "previous_value": "Previous Value",
  "previous_date": "Test Date",
  "change_percent": "Change Magnitude",
  "acknowledge": "I acknowledge this warning"
}
```

## 用户交互流程

1. **页面加载** → 检索所有待审核结果
2. **异步检查** → 并行查询历史数据，执行 Delta Check
3. **警告显示** → 如果检测到变化 > 30%，显示警告对话框
4. **用户确认** → 用户必须勾选确认复选框
5. **记录确认** → 结果ID存储到 localStorage，防止重复显示
6. **继续下一个** → 显示下一个警告（如果有的话）
7. **完成** → 关闭对话框

## 性能考虑

- **异步加载**：Delta Check 数据异步加载，不阻塞UI
- **条件查询**：只对有数值的结果执行检查
- **本地存储缓存**：使用 localStorage 避免重复查询
- **历史限制**：查询限制为14天和20条记录

## 医疗合规性

✅ **符合 LIMS 标准**：
- 检测剧烈波动（样本混淆指标）
- 自动警示，不自动修改数据
- 强制用户确认，形成审计日志

✅ **与危急值 (Panic Values) 的区别**：
- 危急值：绝对值超过阈值（HH/LL）→ 红色警告，强制通知医生
- Delta Check：相对变化超过阈值 → 黄色警告，核实样本和患者信息

## 测试建议

1. **单个历史值**：当前值大幅不同 → 应触发警告
2. **多个历史值**：显示最近值的变化 → 应基于最近值计算
3. **无历史值**：首次检测 → 应返回 `hasDeltaAlert: false`
4. **小变化** (< 30%)：应不触发警告
5. **大变化** (> 30%)：应触发警告
6. **已确认警告**：刷新页面后不再显示

## 未来改进

- [ ] 自定义 Delta Check 阈值（按测试项目）
- [ ] 自适应阈值（基于测试类型和变异系数）
- [ ] Delta Check 审计日志（记录所有警告和确认）
- [ ] 集成到报告中（显示警告标记）
- [ ] Westgard 多规则检查（与质控相关）
