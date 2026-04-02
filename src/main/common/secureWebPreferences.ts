/**
 * 安全的 WebPreferences 配置常量
 * 遵循 Electron 安全最佳实践
 */
import { app, type WebPreferences } from 'electron'

/**
 * 安全配置项及其预期值
 */
const SECURITY_CHECKS: Array<{
  key: keyof WebPreferences
  expectedValue: boolean
  description: string
}> = [
  { key: 'contextIsolation', expectedValue: true, description: '上下文隔离' },
  { key: 'nodeIntegration', expectedValue: false, description: 'Node.js 集成' },
  { key: 'webSecurity', expectedValue: true, description: 'Web 安全策略' }
]

/**
 * 验证窗口的 WebPreferences 安全配置
 * 在开发模式下检测到不安全配置时会输出警告
 * @param prefs WebPreferences 配置对象
 * @param windowName 窗口名称（用于日志输出）
 */
export function validateWindowSecurity(prefs: WebPreferences, windowName?: string): void {
  // 仅在开发模式下输出警告
  if (app.isPackaged) {
    return
  }

  const insecureConfigs: string[] = []

  for (const check of SECURITY_CHECKS) {
    const actualValue = prefs[check.key]
    if (actualValue !== undefined && actualValue !== check.expectedValue) {
      insecureConfigs.push(
        `  - ${check.description} (${check.key}): 当前值=${actualValue}, 期望值=${check.expectedValue}`
      )
    }
  }

  if (insecureConfigs.length > 0) {
    const prefix = windowName ? `[${windowName}]` : '[WindowSecurity]'
    console.warn(`${prefix} 检测到不安全的 WebPreferences 配置:`)
    insecureConfigs.forEach((config) => console.warn(config))
  }
}

/**
 * 标准安全配置 - 适用于大多数窗口
 * - contextIsolation: true - 启用上下文隔离，防止原型污染攻击
 * - nodeIntegration: false - 禁用 Node.js 集成，渲染进程无法直接访问 Node API
 * - webSecurity: true - 启用 Web 安全策略，阻止跨域请求
 * - allowRunningInsecureContent: false - 不允许 HTTPS 页面加载 HTTP 资源
 */
export const SECURE_WEB_PREFERENCES: WebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
  allowRunningInsecureContent: false
}

/**
 * 插件视图安全配置 - 在标准配置基础上启用沙箱
 * - sandbox: true - 启用沙箱，限制渲染进程权限
 */
export const PLUGIN_WEB_PREFERENCES: WebPreferences = {
  ...SECURE_WEB_PREFERENCES,
  sandbox: true
}

/**
 * 主窗口安全配置 - 不启用沙箱（主窗口需要更多权限）
 */
export const MAIN_WINDOW_WEB_PREFERENCES: WebPreferences = {
  ...SECURE_WEB_PREFERENCES,
  sandbox: false,
  preload: undefined // 需要在使用时指定
}

/**
 * 透明窗口安全配置 - 用于悬浮球、Toast 等透明窗口
 */
export const TRANSPARENT_WINDOW_WEB_PREFERENCES: WebPreferences = {
  ...SECURE_WEB_PREFERENCES,
  sandbox: false
}
