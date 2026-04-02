/**
 * 插件权限类型定义
 */

/**
 * 插件权限类型
 */
export type PluginPermission =
  // HIGH RISK - shell
  | 'shell:open-path'
  | 'shell:trash-item'
  // MEDIUM RISK - clipboard
  | 'clipboard:read'
  | 'clipboard:write'
  // HIGH RISK - input
  | 'input:simulate'
  // MEDIUM-HIGH RISK - file
  | 'file:read'
  | 'file:write'
  // MEDIUM/HIGH RISK - network/browser
  | 'http:request'
  | 'browser:control'
  // HIGH RISK - system
  | 'system:process'

/**
 * 权限风险等级
 */
export type PermissionRiskLevel = 'low' | 'medium' | 'high'

/**
 * 权限信息接口
 */
export interface PermissionInfo {
  /** 权限名称 */
  name: PluginPermission
  /** 风险等级 */
  riskLevel: PermissionRiskLevel
  /** 权限描述 */
  description: string
}

/**
 * 所有权限的定义信息
 */
export const PERMISSION_DEFINITIONS: Record<PluginPermission, PermissionInfo> = {
  // HIGH RISK - shell
  'shell:open-path': {
    name: 'shell:open-path',
    riskLevel: 'high',
    description: '通过 shell 打开指定路径（文件/目录/URL）'
  },
  'shell:trash-item': {
    name: 'shell:trash-item',
    riskLevel: 'high',
    description: '将文件或目录移至回收站'
  },
  // MEDIUM RISK - clipboard
  'clipboard:read': {
    name: 'clipboard:read',
    riskLevel: 'medium',
    description: '读取剪贴板内容（文本、图片、文件）'
  },
  'clipboard:write': {
    name: 'clipboard:write',
    riskLevel: 'medium',
    description: '写入剪贴板内容（文本、图片、文件）'
  },
  // HIGH RISK - input
  'input:simulate': {
    name: 'input:simulate',
    riskLevel: 'high',
    description: '模拟键盘输入和鼠标操作'
  },
  // MEDIUM-HIGH RISK - file
  'file:read': {
    name: 'file:read',
    riskLevel: 'medium',
    description: '读取文件系统中的文件'
  },
  'file:write': {
    name: 'file:write',
    riskLevel: 'medium',
    description: '写入或创建文件系统中的文件'
  },
  // MEDIUM/HIGH RISK - network/browser
  'http:request': {
    name: 'http:request',
    riskLevel: 'medium',
    description: '发送 HTTP/HTTPS 请求'
  },
  'browser:control': {
    name: 'browser:control',
    riskLevel: 'high',
    description: '控制 ZBrowser 浏览器自动化'
  },
  // HIGH RISK - system
  'system:process': {
    name: 'system:process',
    riskLevel: 'high',
    description: '获取系统进程信息'
  }
}

/**
 * 获取指定权限的风险等级
 * @param permission 权限名称
 * @returns 风险等级，如果权限不存在返回 undefined
 */
export function getPermissionRiskLevel(
  permission: PluginPermission
): PermissionRiskLevel | undefined {
  return PERMISSION_DEFINITIONS[permission]?.riskLevel
}
