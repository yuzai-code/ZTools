## ADDED Requirements

### Requirement: API Keys must be encrypted at rest

所有 API Keys（AI 模型、HTTP Server、MCP Server）必须使用 `safeStorage` API 加密后存储，不得明文存储在数据库中。

#### Scenario: AI model API key is encrypted before storage

- **WHEN** 用户添加或更新 AI 模型配置
- **THEN** `apiKey` 字段必须在存储前使用 `safeStorage.encryptString` 加密

#### Scenario: HTTP Server API key is encrypted before storage

- **WHEN** 保存 HTTP Server 配置
- **THEN** `apiKey` 字段必须在存储前加密

#### Scenario: MCP Server API key is encrypted before storage

- **WHEN** 保存 MCP Server 配置
- **THEN** `apiKey` 字段必须在存储前加密

### Requirement: Encrypted data must be decrypted on read

从数据库读取加密数据时，必须自动解密并返回明文供应用使用。

#### Scenario: AI model API key is decrypted on read

- **WHEN** 读取 AI 模型列表
- **THEN** `apiKey` 字段必须自动解密后返回

#### Scenario: Decryption handles missing or invalid data

- **WHEN** 解密失败（数据损坏或密钥变更）
- **THEN** 返回空字符串或默认值，并记录错误日志

### Requirement: Encryption availability check

加密操作前必须检查 `safeStorage.isEncryptionAvailable()`，在不可用时提供降级方案。

#### Scenario: Encryption available on macOS

- **WHEN** 在 macOS 上运行
- **THEN** `safeStorage.isEncryptionAvailable()` 必须返回 `true`

#### Scenario: Encryption available on Windows

- **WHEN** 在 Windows 上运行
- **THEN** `safeStorage.isEncryptionAvailable()` 必须返回 `true`

#### Scenario: Fallback when encryption unavailable

- **WHEN** `safeStorage.isEncryptionAvailable()` 返回 `false`
- **THEN** 系统必须输出警告日志，并以明文存储（降级方案）

### Requirement: Migration of existing plaintext data

系统启动时必须检测并迁移现有的明文敏感数据。

#### Scenario: Migrate plaintext API keys on startup

- **WHEN** 系统启动时检测到明文存储的 API Key
- **THEN** 必须自动加密并更新数据库

#### Scenario: Migration is idempotent

- **WHEN** 已加密的数据再次被处理
- **THEN** 必须跳过迁移，不重复加密

### Requirement: WebDAV password encryption consistency

WebDAV 密码加密必须与现有实现保持一致（已在 `sync.ts` 中实现）。

#### Scenario: WebDAV password uses existing encryption

- **WHEN** 保存 WebDAV 配置
- **THEN** 必须使用 `safeStorage.encryptString` 加密密码（与现有实现一致）

### Requirement: Encryption utility module

必须提供统一的加密工具模块，供所有需要加密的模块使用。

#### Scenario: Centralized encryption utilities

- **WHEN** 任何模块需要加密/解密敏感数据
- **THEN** 必须使用统一的工具函数 `encryptSensitiveData` 和 `decryptSensitiveData`

#### Scenario: Encryption utility handles errors gracefully

- **WHEN** 加密或解密过程中发生错误
- **THEN** 工具函数必须捕获异常并返回安全的默认值
