# 插件权限系统

ZTools 插件权限系统用于控制插件对敏感 API 的访问。插件需要在 `plugin.json` 中声明所需权限，未声明权限的 API 调用将被拒绝。

## 权限类型

### Shell 操作（高风险）

| 权限               | 风险等级 | 说明                                     |
| ------------------ | -------- | ---------------------------------------- |
| `shell:open-path`  | 高       | 通过 shell 打开指定路径（文件/目录/URL） |
| `shell:trash-item` | 高       | 将文件或目录移至回收站                   |

### 剪贴板操作（中风险）

| 权限              | 风险等级 | 说明                               |
| ----------------- | -------- | ---------------------------------- |
| `clipboard:read`  | 中       | 读取剪贴板内容（文本、图片、文件） |
| `clipboard:write` | 中       | 写入剪贴板内容（文本、图片、文件） |

### 输入模拟（高风险）

| 权限             | 风险等级 | 说明                   |
| ---------------- | -------- | ---------------------- |
| `input:simulate` | 高       | 模拟键盘输入和鼠标操作 |

### 文件系统（中风险）

| 权限         | 风险等级 | 说明                       |
| ------------ | -------- | -------------------------- |
| `file:read`  | 中       | 读取文件系统中的文件       |
| `file:write` | 中       | 写入或创建文件系统中的文件 |

### 网络与浏览器

| 权限              | 风险等级 | 说明                       |
| ----------------- | -------- | -------------------------- |
| `http:request`    | 中       | 发送 HTTP/HTTPS 请求       |
| `browser:control` | 高       | 控制 ZBrowser 浏览器自动化 |

### 系统操作（高风险）

| 权限             | 风险等级 | 说明             |
| ---------------- | -------- | ---------------- |
| `system:process` | 高       | 获取系统进程信息 |

## 在 plugin.json 中声明权限

在插件的 `plugin.json` 文件中添加 `permissions` 字段：

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "我的插件",
  "main": "index.html",
  "features": [...],
  "permissions": [
    "clipboard:read",
    "clipboard:write",
    "http:request"
  ]
}
```

### 声明原则

- **最小权限**：只声明插件实际需要的权限，不要过度申请
- **按需声明**：不同功能可能需要不同权限，确保每个权限都有明确的使用场景
- **高风险权限谨慎使用**：`shell:open-path`、`input:simulate`、`system:process` 等高风险权限需要特别注意安全性

### 权限声明示例

#### 剪贴板工具插件

```json
{
  "permissions": ["clipboard:read", "clipboard:write"]
}
```

#### 文件管理插件

```json
{
  "permissions": ["file:read", "file:write", "shell:open-path", "shell:trash-item"]
}
```

#### 网络请求插件

```json
{
  "permissions": ["http:request"]
}
```

#### 浏览器自动化插件

```json
{
  "permissions": ["browser:control", "http:request"]
}
```

## 权限检查机制

### 内置插件

内置插件（`setting`、`system`）自动拥有所有权限，无需额外声明。

### 第三方插件

第三方插件的权限检查流程：

1. 加载插件时，从 `plugin.json` 解析 `permissions` 字段
2. 插件调用受保护 API 时，检查是否声明了对应权限
3. 如果未声明权限，API 调用将被拒绝并记录警告日志

### 权限缺失时的行为

当插件调用需要权限的 API 但未声明权限时：

- API 调用被拒绝，抛出错误
- 控制台输出警告日志：`Plugin at "<path>" does not have required permission: <permission>`
- 插件需要在 `plugin.json` 中添加对应权限后才能使用该 API

## 需要权限的 API 列表

| API                      | 所需权限           | 说明              |
| ------------------------ | ------------------ | ----------------- |
| `shellOpenPath`          | `shell:open-path`  | 打开文件/目录/URL |
| `shellTrashItem`         | `shell:trash-item` | 移至回收站        |
| `simulateKeyboardTap`    | `input:simulate`   | 模拟键盘按键      |
| `simulateKeyboardType`   | `input:simulate`   | 模拟文本输入      |
| `simulatePaste`          | `input:simulate`   | 模拟粘贴          |
| `sendInputEvent`         | `input:simulate`   | 发送输入事件      |
| `clipboard.writeContent` | `clipboard:write`  | 写入剪贴板        |
| `getCopyedFiles`         | `clipboard:read`   | 读取剪贴板文件    |
