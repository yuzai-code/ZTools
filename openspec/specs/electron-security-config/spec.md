## ADDED Requirements

### Requirement: All windows and views must enable contextIsolation

所有 BrowserWindow 和 WebContentsView 必须启用 `contextIsolation: true`，隔离 preload 脚本与渲染进程的 JavaScript 环境。

#### Scenario: Plugin WebContentsView has contextIsolation enabled

- **WHEN** 创建插件 WebContentsView
- **THEN** `webPreferences.contextIsolation` 必须为 `true`

#### Scenario: Main window has contextIsolation enabled

- **WHEN** 创建主窗口 BrowserWindow
- **THEN** `webPreferences.contextIsolation` 必须为 `true`

#### Scenario: Floating ball window has contextIsolation enabled

- **WHEN** 创建悬浮球窗口
- **THEN** `webPreferences.contextIsolation` 必须为 `true`

#### Scenario: Toast notification window has contextIsolation enabled

- **WHEN** 创建 Toast 通知窗口
- **THEN** `webPreferences.contextIsolation` 必须为 `true`

### Requirement: All windows and views must disable nodeIntegration

所有 BrowserWindow 和 WebContentsView 必须设置 `nodeIntegration: false`，禁止渲染进程直接访问 Node.js API。

#### Scenario: Plugin WebContentsView has nodeIntegration disabled

- **WHEN** 创建插件 WebContentsView
- **THEN** `webPreferences.nodeIntegration` 必须为 `false`

#### Scenario: Floating ball window has nodeIntegration disabled

- **WHEN** 创建悬浮球窗口
- **THEN** `webPreferences.nodeIntegration` 必须为 `false`

#### Scenario: Toast notification window has nodeIntegration disabled

- **WHEN** 创建 Toast 通知窗口
- **THEN** `webPreferences.nodeIntegration` 必须为 `false`

### Requirement: All windows and views must enable webSecurity

所有 BrowserWindow 和 WebContentsView 必须启用 `webSecurity: true`，强制执行同源策略。

#### Scenario: Plugin WebContentsView has webSecurity enabled

- **WHEN** 创建插件 WebContentsView
- **THEN** `webPreferences.webSecurity` 必须为 `true`

#### Scenario: Main window has webSecurity enabled

- **WHEN** 创建主窗口 BrowserWindow
- **THEN** `webPreferences.webSecurity` 必须为 `true`

### Requirement: Plugin views must enable sandbox

插件 WebContentsView 必须启用 `sandbox: true`，限制渲染进程的系统访问权限。

#### Scenario: Plugin WebContentsView has sandbox enabled

- **WHEN** 创建插件 WebContentsView
- **THEN** `webPreferences.sandbox` 必须为 `true`

#### Scenario: Sandbox restricts Node.js access

- **WHEN** 插件渲染进程尝试访问 `require` 或 `process`
- **THEN** 必须抛出 `ReferenceError` 或返回 `undefined`

### Requirement: Disable allowRunningInsecureContent

所有窗口和视图必须设置 `allowRunningInsecureContent: false`，禁止在 HTTPS 页面加载 HTTP 资源。

#### Scenario: Insecure content is blocked

- **WHEN** HTTPS 页面尝试加载 HTTP 资源
- **THEN** 资源加载必须被阻止

### Requirement: Preload scripts must use contextBridge

启用 contextIsolation 后，preload 脚本必须使用 `contextBridge.exposeInMainWorld` 暴露 API，而非直接挂载到 `window` 对象。

#### Scenario: Preload uses contextBridge for API exposure

- **WHEN** preload 脚本需要暴露 API 到渲染进程
- **THEN** 必须使用 `contextBridge.exposeInMainWorld('ztools', apiObject)`

#### Scenario: Direct window assignment fails

- **WHEN** preload 脚本尝试直接赋值 `window.ztools = {...}`
- **THEN** 渲染进程无法访问该对象（隔离生效）

### Requirement: Secure configuration validation

系统必须提供安全配置验证机制，在开发模式下检测不安全配置并输出警告。

#### Scenario: Dev mode warns on insecure config

- **WHEN** 开发模式下创建窗口时检测到不安全配置
- **THEN** 控制台输出警告信息，指出具体的安全风险
