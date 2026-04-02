/**
 * 安全的 WebPreferences 配置常量
 * 遵循 Electron 安全最佳实践
 */
import type { WebPreferences } from 'electron'

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
