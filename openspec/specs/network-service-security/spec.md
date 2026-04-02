## ADDED Requirements

### Requirement: MCP Server must bind to localhost only

MCP Server 必须仅绑定到 `127.0.0.1`，禁止绑定到 `0.0.0.0` 或其他公网地址。

#### Scenario: MCP Server binds to 127.0.0.1

- **WHEN** 启动 MCP Server
- **THEN** 必须调用 `server.listen(port, '127.0.0.1', callback)`

#### Scenario: MCP Server rejects external connections

- **WHEN** 外部 IP 尝试连接 MCP Server
- **THEN** 连接必须被拒绝（操作系统级别）

### Requirement: HTTP Server binds to localhost only

HTTP Server 必须仅绑定到 `127.0.0.1`。

#### Scenario: HTTP Server binds to 127.0.0.1

- **WHEN** 启动 HTTP Server
- **THEN** 必须调用 `server.listen(port, '127.0.0.1', callback)`

### Requirement: CORS must restrict allowed origins

CORS 配置必须收紧，禁止使用通配符 `*`，仅允许本地来源。

#### Scenario: CORS allows localhost origin

- **WHEN** 请求携带 `Origin: http://127.0.0.1:xxxx`
- **THEN** `Access-Control-Allow-Origin` 必须返回 `http://127.0.0.1:xxxx`

#### Scenario: CORS rejects wildcard configuration

- **WHEN** 配置 CORS 响应头
- **THEN** 不得设置 `Access-Control-Allow-Origin: *`

#### Scenario: CORS allows same-origin requests

- **WHEN** 请求来源与服务地址相同
- **THEN** 必须允许请求通过

### Requirement: API Key authentication required

所有网络服务 API 必须要求 API Key 认证，未认证请求必须返回 401。

#### Scenario: Request without API Key is rejected

- **WHEN** 请求未携带 `Authorization` 头或 `key` 参数
- **THEN** 必须返回 HTTP 401 Unauthorized

#### Scenario: Request with invalid API Key is rejected

- **WHEN** 请求携带错误的 API Key
- **THEN** 必须返回 HTTP 401 Unauthorized

#### Scenario: Request with valid API Key is accepted

- **WHEN** 请求携带正确的 `Authorization: Bearer <apiKey>`
- **THEN** 必须处理请求并返回正常响应

### Requirement: API Key transmission security

API Key 不得通过 URL 查询参数传输（避免日志泄露），应使用 Authorization 头。

#### Scenario: Prefer Authorization header over query parameter

- **WHEN** 客户端发送请求
- **THEN** 应使用 `Authorization: Bearer <apiKey>` 而非 `?key=<apiKey>`

#### Scenario: Query parameter authentication is deprecated but supported

- **WHEN** 请求使用 `?key=` 参数传递 API Key
- **THEN** 必须记录警告日志，但仍处理请求（向后兼容）

### Requirement: Request body size limit

网络服务必须限制请求体大小，防止 DoS 攻击。

#### Scenario: Request body limited to 1MB

- **WHEN** 请求体大小超过 1MB
- **THEN** 必须拒绝请求并返回错误

### Requirement: Service status endpoint

网络服务必须提供状态检查端点，但不泄露敏感信息。

#### Scenario: Status endpoint returns minimal info

- **WHEN** 请求 `GET /` 或 `GET /mcp`
- **THEN** 返回服务名称和版本，不返回 API Key 或配置详情
