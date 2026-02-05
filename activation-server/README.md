# SimpleLIMS 激活服务器

这是 SimpleLIMS 离线软件的激活服务，部署到 Vercel 后用于生成和管理激活码。

## 功能

- 🔐 **用户激活页面** (`/`) - 用户输入设备码+序列号获取激活码
- 👨‍💼 **管理后台** (`/admin.html`) - 生成序列号、查看激活记录、解绑设备
- 🛡️ **速率限制** - 防止暴力破解
- 📦 **KV 存储** - 使用 Vercel KV (Redis) 存储数据

## 部署步骤

### 1. 创建 Vercel 项目

```bash
cd activation-server
npx vercel link
```

### 2. 配置 Vercel KV

1. 进入 Vercel Dashboard → 你的项目
2. 点击 **Storage** 选项卡
3. 点击 **Create Database** → 选择 **KV**
4. 创建完成后 KV 会自动连接到项目

### 3. 配置环境变量

在 Vercel Dashboard → Settings → Environment Variables 中添加：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `PRIVATE_KEY` | RSA 私钥 (用于签名激活码) | 完整私钥内容 |
| `ADMIN_PASSWORD` | 管理后台密码 | `your-secure-password` |
| `TURNSTILE_SECRET` | (可选) Cloudflare Turnstile 密钥 | - |

**重要**: `PRIVATE_KEY` 需要使用 `scripts/private_key.pem` 的完整内容，包括 `-----BEGIN RSA PRIVATE KEY-----` 和 `-----END RSA PRIVATE KEY-----`。

### 4. 部署

```bash
npx vercel --prod
```

### 5. 配置自定义域名 (可选)

1. 在 Vercel Dashboard → Settings → Domains
2. 添加你的域名，如 `lims.me`
3. 按提示配置 DNS 记录

## 使用方法

### 用户激活流程

1. 用户在 SimpleLIMS 中看到设备码 (如 `K9P2-X5M8-A3B7`)
2. 用手机访问 `https://your-domain.vercel.app/?mid=K9P2-X5M8-A3B7`
3. 输入购买时获得的序列号 (如 `LIMS-2026-A7X9-P3M5`)
4. 获取激活码，复制或下载 `.lic` 文件
5. 在 SimpleLIMS 中输入激活码或导入文件

### 管理员操作

1. 访问 `https://your-domain.vercel.app/admin.html`
2. 输入管理密码登录
3. 可以：
   - 批量生成序列号
   - 查看所有序列号状态
   - 查看激活记录
   - 撤销泄露的序列号
   - 解绑设备（用于设备更换）

## API 接口

### POST /api/activate

激活接口，用户获取激活码。

**请求体:**
```json
{
  "deviceCode": "K9P2-X5M8-A3B7",
  "serialNumber": "LIMS-2026-A7X9-P3M5",
  "captchaToken": "..." // 可选
}
```

**成功响应:**
```json
{
  "success": true,
  "licenseKey": "eyJtYWNoaW5lSWQi...",
  "expiresAt": "2027-02-06T00:00:00Z",
  "type": "professional"
}
```

### POST /api/admin/sn?action=generate

生成序列号 (需要认证)。

**请求头:**
```
Authorization: Bearer <admin_password>
```

**请求体:**
```json
{
  "count": 5,
  "type": "professional",
  "days": 365,
  "customerName": "张三",
  "customerEmail": "zhang@example.com"
}
```

### GET /api/admin/sn?action=list

列出所有序列号 (需要认证)。

### POST /api/admin/sn?action=revoke

撤销序列号 (需要认证)。

### POST /api/admin/sn?action=unbind

解绑设备 (需要认证)。

## 安全注意事项

1. **私钥保护**: `PRIVATE_KEY` 环境变量包含敏感信息，确保只在 Vercel 环境变量中配置
2. **强密码**: 使用强密码作为 `ADMIN_PASSWORD`
3. **HTTPS**: Vercel 自动启用 HTTPS
4. **速率限制**: 内置速率限制防止暴力破解

## 本地开发

```bash
cd activation-server
npm install
npx vercel dev
```

然后访问 `http://localhost:3000`

## 文件结构

```
activation-server/
├── api/
│   ├── activate.ts       # 用户激活 API
│   └── admin/
│       └── sn.ts         # 管理员 API
├── public/
│   ├── index.html        # 用户激活页面
│   └── admin.html        # 管理后台
├── package.json
├── vercel.json           # Vercel 配置
└── README.md
```
