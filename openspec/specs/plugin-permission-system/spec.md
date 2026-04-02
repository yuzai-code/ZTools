## ADDED Requirements

### Requirement: Plugin must declare permissions in plugin.json

插件必须在 `plugin.json` 中通过 `permissions` 字段声明所需权限，未声明的危险 API 调用将被记录警告。

#### Scenario: Plugin declares required permissions

- **WHEN** 插件需要使用危险 API（如 shell 操作、输入模拟）
- **THEN** 必须在 `plugin.json` 的 `permissions` 数组中声明对应权限

#### Scenario: Permission format follows convention

- **WHEN** 声明权限
- **THEN** 必须使用 `<category>:<action>` 格式，如 `shell:open-path`、`clipboard:read`

### Requirement: Dangerous APIs require permission check

危险 API 调用时必须检查插件是否声明了相应权限。

#### Scenario: Shell API requires permission

- **WHEN** 插件调用 `shellOpenPath` 或 `shellTrashItem`
- **THEN** 必须检查插件是否声明 `shell:open-path` 或 `shell:trash-item` 权限

#### Scenario: Input simulation requires permission

- **WHEN** 插件调用 `simulateKeyboardTap` 或 `simulateMouseClick`
- **THEN** 必须检查插件是否声明 `input:simulate` 权限

#### Scenario: Clipboard API requires permission

- **WHEN** 插件调用 `clipboard.writeContent` 或 `getCopyedFiles`
- **THEN** 必须检查插件是否声明 `clipboard:write` 或 `clipboard:read` 权限

### Requirement: Permission denied handling

当插件尝试调用未授权的危险 API 时，系统必须拒绝调用并记录警告。

#### Scenario: Unauthorized API call is rejected

- **WHEN** 插件调用未声明权限的危险 API
- **THEN** 必须抛出 `PermissionDeniedError` 或返回错误响应

#### Scenario: Warning logged for missing permission

- **WHEN** 检测到权限缺失
- **THEN** 必须记录警告日志，包含插件名称、缺失权限、调用的 API

### Requirement: Built-in plugins have all permissions

内置插件（setting、system）默认拥有所有权限，无需显式声明。

#### Scenario: Internal plugin bypasses permission check

- **WHEN** 内置插件调用任意 API
- **THEN** 权限检查必须通过

#### Scenario: Internal plugin identified by canUseInternalApi flag

- **WHEN** 检查插件权限
- **THEN** 如果 `pluginInfo.canUseInternalApi` 为 `true`，跳过权限检查

### Requirement: Backward compatibility for legacy plugins

对于未声明权限的旧插件，系统采用宽松模式：允许调用但记录警告。

#### Scenario: Legacy plugin API call succeeds with warning

- **WHEN** 旧插件（无 permissions 字段）调用危险 API
- **THEN** API 调用必须成功，但记录警告日志

#### Scenario: Warning suggests adding permission declaration

- **WHEN** 检测到旧插件调用危险 API
- **THEN** 警告日志必须建议开发者添加权限声明

### Requirement: Permission types definition

系统必须定义完整的权限类型列表及其对应的风险级别。

#### Scenario: High-risk permissions require explicit declaration

- **WHEN** 插件声明高风险权限（如 `shell:trash-item`、`input:simulate`）
- **THEN** 权限声明必须存在，否则拒绝调用

#### Scenario: Permission list is documented

- **WHEN** 开发者查阅文档
- **THEN** 必须提供完整的权限列表及其说明

### Requirement: Permission metadata in plugin info

插件加载时，必须解析 `permissions` 字段并存储在插件信息中。

#### Scenario: Permissions parsed on plugin load

- **WHEN** 加载插件
- **THEN** 必须从 `plugin.json` 读取 `permissions` 数组并存储

#### Scenario: Permissions accessible for API checks

- **WHEN** API 需要验证权限
- **THEN** 必须能够从 `pluginInfo.permissions` 获取已声明的权限列表
