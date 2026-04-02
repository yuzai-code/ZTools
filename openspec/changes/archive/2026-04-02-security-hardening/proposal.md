## Why

ZTools 作为内网使用的应用启动器，当前存在多个严重安全漏洞，包括：Electron 安全配置缺陷（禁用上下文隔离、沙箱）、敏感数据明文存储、网络服务暴露到所有网卡、插件权限过大等问题。这些问题可能导致恶意插件执行任意代码、敏感信息泄露、内网攻击等风险。为确保内网安全使用，必须修复所有高危和中危安全问题。

## What Changes

### 高危修复

- **BREAKING** 启用 `contextIsolation: true` - 所有 WebContentsView 和 BrowserWindow
- **BREAKING** 禁用 `nodeIntegration` - floatingBallManager、toast 窗口当前启用了 nodeIntegration
- **BREAKING** 启用 `webSecurity: true` - 阻止跨域请求
- **BREAKING** 启用 `sandbox: true` - 限制渲染进程权限
- 移除 `allowRunningInsecureContent: true` - 不允许加载混合内容
- MCP Server 绑定地址从 `0.0.0.0` 改为 `127.0.0.1`
- 敏感数据加密存储 - API Keys、WebDAV 密码使用 safeStorage 加密
- 收紧 CORS 配置 - 从 `*` 改为仅允许本地来源

### 中危修复

- 命令注入修复 - `screenCapture.ts`、`macLauncher.ts` 使用 execFile 替代 exec
- 移除动态代码执行 - `lanzou.ts` 中的动态函数调用
- innerHTML 安全处理 - 使用 textContent 或 DOMPurify

### 插件权限控制

- 实现插件权限声明系统 - plugin.json 中声明所需权限
- 危险 API 添加权限检查 - shell 操作、输入模拟、文件操作等

## Capabilities

### New Capabilities

- `electron-security-config`: Electron 窗口和视图的安全配置标准，包括 contextIsolation、sandbox、webSecurity 等
- `sensitive-data-encryption`: 敏感数据（API Keys、密码）的加密存储机制
- `network-service-security`: HTTP/MCP 网络服务的安全配置（绑定地址、CORS、认证）
- `plugin-permission-system`: 插件权限声明和检查机制

### Modified Capabilities

无现有 capabilities 需要修改。

## Impact

### 代码影响

- `src/main/managers/pluginManager.ts` - WebContentsView 安全配置
- `src/main/managers/windowManager.ts` - 主窗口安全配置
- `src/main/core/floatingBallManager.ts` - 悬浮球窗口安全配置
- `src/main/api/plugin/toast.ts` - Toast 窗口安全配置
- `src/main/core/superPanelManager.ts` - 超级面板安全配置
- `src/main/core/detachedWindowManager.ts` - 分离窗口安全配置
- `src/main/core/pluginWindowManager.ts` - 插件窗口安全配置
- `src/main/core/httpServer.ts` - HTTP 服务安全配置
- `src/main/core/mcpServer.ts` - MCP 服务安全配置
- `src/main/api/renderer/aiModels.ts` - AI 模型 API Key 加密
- `src/main/core/screenCapture.ts` - 命令注入修复
- `src/main/core/commandLauncher/macLauncher.ts` - 命令注入修复
- `src/main/utils/lanzou.ts` - 移除动态代码执行
- `resources/preload.js` - 权限检查逻辑

### API 影响

- 插件 API 可能需要权限声明才能使用危险功能
- 现有插件可能需要更新 plugin.json 添加权限声明

### 兼容性影响

- 启用 contextIsolation 后，preload 脚本需要重构
- 部分插件可能因权限不足而功能受限
