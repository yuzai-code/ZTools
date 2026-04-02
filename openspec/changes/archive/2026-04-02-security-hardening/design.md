## Context

ZTools 是一个 Electron 38 应用启动器，支持第三方插件系统。当前安全配置存在多个严重漏洞：

**当前状态问题：**

- 6 个窗口/视图禁用了 `contextIsolation`
- 2 个窗口启用了 `nodeIntegration`（floatingBallManager、toast）
- 7 个窗口/视图禁用了 `webSecurity`
- 所有插件视图禁用了 `sandbox`
- MCP Server 绑定 `0.0.0.0`，暴露到内网
- API Keys、密码等敏感数据明文存储在 LMDB
- CORS 配置为 `*`，允许任意来源
- 存在命令注入风险（使用 shell 执行命令）
- 蓝奏云下载工具使用动态代码执行

**约束：**

- 必须保持插件 API 兼容性
- 不能破坏现有插件功能
- 需要考虑内网使用场景

## Goals / Non-Goals

**Goals:**

- 修复所有高危安全问题（12 个）
- 修复所有中危安全问题（8 个）
- 实现插件权限声明系统
- 敏感数据加密存储
- 网络服务安全加固

**Non-Goals:**

- 不重构整体架构
- 不实现完整的 CSP 策略（后续迭代）
- 不实现插件沙箱隔离（后续迭代）
- 不修改插件 API 签名

## Decisions

### D1: Electron 安全配置标准

**决定：** 采用最小权限原则配置所有窗口和视图

```typescript
// 标准安全配置
const SECURE_WEB_PREFERENCES = {
  contextIsolation: true, // 启用上下文隔离
  nodeIntegration: false, // 禁用 Node 集成
  webSecurity: true, // 启用 Web 安全
  sandbox: true, // 启用沙箱（插件视图）
  allowRunningInsecureContent: false
}
```

**备选方案：**

1. ✅ 全部启用安全配置 - 可能影响兼容性，但最安全
2. ❌ 仅对插件启用 - 不够彻底，主窗口也有风险
3. ❌ 保持现状，添加警告 - 不解决问题

**理由：** Electron 官方强烈建议启用这些选项，禁用它们会导致严重的 RCE 风险。

### D2: contextIsolation 兼容性处理

**决定：** 使用 `contextBridge` 重构 preload 脚本

**实现方式：**

```javascript
// 旧方式（不安全）- 直接挂载到 window
// window.ztools = { ... }

// 新方式（安全）- 使用 contextBridge
contextBridge.exposeInMainWorld('ztools', {
  // 只暴露必要的 API
  db: {
    put: (doc) => ipcRenderer.invoke('db:put', doc)
    // ...
  }
})
```

**注意：** `resources/preload.js` 当前直接挂载 `window.ztools`，需要重构为 `contextBridge` 模式。

### D3: 敏感数据加密方案

**决定：** 使用 Electron 的 `safeStorage` API 加密敏感数据

**实现：**

```typescript
import { safeStorage } from 'electron'

// 加密
function encryptSensitiveData(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64')
  }
  return value // 回退：明文存储（开发环境）
}

// 解密
function decryptSensitiveData(encrypted: string): string {
  if (safeStorage.isEncryptionAvailable() && encrypted) {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  }
  return encrypted
}
```

**应用范围：**

- AI 模型 API Keys (`aiModels.ts`)
- HTTP Server API Key (`httpServer.ts`)
- MCP Server API Key (`mcpServer.ts`)
- WebDAV 密码（已实现）

### D4: 网络服务安全配置

**决定：** 收紧网络服务的访问控制

**MCP Server：**

```typescript
// 旧配置 - 绑定所有网卡
// this.server.listen(this.config.port, '0.0.0.0', ...)

// 新配置 - 仅绑定本地
this.server.listen(this.config.port, '127.0.0.1', ...)
```

**CORS 配置：**

```typescript
// 旧配置 - 允许任意来源
// 'Access-Control-Allow-Origin': '*'

// 新配置 - 仅允许本地
'Access-Control-Allow-Origin': 'http://127.0.0.1:' + this.config.port
```

**备选方案：**

1. ✅ 绑定 127.0.0.1 + 收紧 CORS - 最安全
2. ❌ 保持 0.0.0.0 + 添加 IP 白名单 - 复杂且不必要
3. ❌ 完全禁用网络服务 - 影响功能

### D5: 命令注入修复

**决定：** 使用 `execFile` 替代 shell 命令执行

**修复方式：**

```typescript
// 危险方式（当前代码）- 使用 shell 字符串拼接
// exec(`screencapture -i -r "${tmpPath}"`, callback)

// 安全方式（修复后）- 使用 execFile 避免注入
import { execFile } from 'child_process'
execFile('screencapture', ['-i', '-r', tmpPath], callback)
```

**影响文件：**

- `src/main/core/screenCapture.ts`
- `src/main/core/commandLauncher/macLauncher.ts`

**参考：** 项目已有安全工具 `src/utils/execFileNoThrow.ts`

### D6: 插件权限系统设计

**决定：** 在 plugin.json 中声明权限，运行时检查

**权限声明格式：**

```json
{
  "name": "my-plugin",
  "permissions": [
    "shell:open-path",
    "clipboard:read",
    "clipboard:write",
    "input:simulate",
    "file:read",
    "file:write"
  ]
}
```

**权限检查流程：**

```
插件调用 API → preload 检查权限 → IPC 到主进程 → 主进程验证权限 → 执行/拒绝
```

**权限分类：**
| 权限 | 风险级别 | 说明 |
|------|---------|------|
| `shell:open-path` | 高 | 打开文件/URL |
| `shell:trash-item` | 高 | 删除文件 |
| `clipboard:read` | 中 | 读取剪贴板 |
| `clipboard:write` | 中 | 写入剪贴板 |
| `input:simulate` | 高 | 模拟输入 |
| `file:read` | 中 | 读取文件 |
| `file:write` | 高 | 写入文件 |
| `http:request` | 中 | HTTP 请求 |
| `browser:control` | 高 | 浏览器自动化 |

## Risks / Trade-offs

### R1: 插件兼容性问题

**风险：** 启用 contextIsolation 后，现有插件可能无法正常工作

**缓解措施：**

- 使用 `contextBridge` 保持 API 兼容
- 提供迁移指南
- 内置插件优先适配测试

### R2: 性能影响

**风险：** sandbox 和 contextIsolation 可能带来轻微性能开销

**缓解措施：**

- 性能影响通常可忽略（<5%）
- 对用户体验无明显影响

### R3: 权限系统复杂度

**风险：** 权限系统增加开发和使用复杂度

**缓解措施：**

- 提供默认权限集（向后兼容）
- 权限声明可选，缺失时警告但不阻止
- 提供权限配置 UI

### R4: 敏感数据加密回退

**风险：** 某些环境（Linux 无密钥环）safeStorage 不可用

**缓解措施：**

- 检测加密可用性
- 不可用时降级为明文存储并警告
- 建议用户配置密钥环

## Migration Plan

### 阶段 1: 核心安全配置（P0）

1. 修复 `nodeIntegration` 问题（floatingBallManager、toast）
2. MCP Server 绑定 127.0.0.1
3. 收紧 CORS 配置

### 阶段 2: Electron 安全加固（P1）

1. 启用 `contextIsolation`
2. 重构 preload 脚本使用 `contextBridge`
3. 启用 `webSecurity`
4. 启用 `sandbox`

### 阶段 3: 敏感数据加密（P1）

1. 实现 `safeStorage` 加密工具函数
2. 加密 AI 模型 API Keys
3. 加密 HTTP/MCP Server API Keys

### 阶段 4: 代码安全修复（P2）

1. 修复命令注入问题
2. 移除动态代码执行
3. 处理 innerHTML 安全问题

### 阶段 5: 插件权限系统（P2）

1. 定义权限类型和声明格式
2. 实现权限检查机制
3. 更新内置插件添加权限声明

### 回滚策略

- 每个阶段独立可回滚
- 保留配置开关可快速禁用新安全特性
- 数据库迁移可逆（加密数据保留明文备份）

## Open Questions

1. **Q: 是否需要支持插件权限动态申请？**
   - 类似移动应用的运行时权限请求
   - 当前设计：仅支持声明式权限

2. **Q: 内置插件是否需要权限声明？**
   - 当前设计：内置插件默认拥有所有权限
   - 可选：内置插件也声明权限，便于审计

3. **Q: 如何处理不声明权限的旧插件？**
   - 选项 A：拒绝调用危险 API（严格）
   - 选项 B：允许调用但记录警告（宽松）
   - 当前倾向：选项 B，提供迁移期
