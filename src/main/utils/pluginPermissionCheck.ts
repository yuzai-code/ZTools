/**
 * 插件权限检查工具
 */

import { PluginPermission } from '../types/pluginPermissions'

/**
 * 内置插件名称列表
 */
const INTERNAL_PLUGIN_NAMES = ['setting', 'system'] as const

/**
 * 判断是否为内置插件
 * @param pluginNameOrPath 插件名称或路径
 * @returns 是否为内置插件
 */
export function isInternalPlugin(pluginNameOrPath: string): boolean {
  // 如果是路径，提取最后一个路径段作为插件名
  const name = pluginNameOrPath.includes('/')
    ? pluginNameOrPath.split('/').pop() || pluginNameOrPath
    : pluginNameOrPath
  return INTERNAL_PLUGIN_NAMES.includes(name as (typeof INTERNAL_PLUGIN_NAMES)[number])
}

/**
 * 插件信息接口（从 plugin.json 读取）
 */
export interface PluginInfo {
  /** 插件名称 */
  name: string
  /** 插件路径 */
  path?: string
  /** 声明的权限列表 */
  permissions?: PluginPermission[]
}

/**
 * 从插件信息中获取声明的权限列表
 * @param pluginInfo 插件信息对象
 * @returns 权限数组
 */
export function getPluginPermissions(pluginInfo: PluginInfo): PluginPermission[] {
  return pluginInfo.permissions || []
}

/**
 * 检查插件是否具有指定权限
 * @param pluginPath 插件路径（用于判断内置插件）
 * @param permission 要检查的权限
 * @param declaredPermissions 插件声明的权限数组
 * @returns 是否有权限
 */
export function checkPermission(
  pluginPath: string,
  permission: PluginPermission,
  declaredPermissions: PluginPermission[]
): boolean {
  // 内置插件拥有所有权限
  if (isInternalPlugin(pluginPath)) {
    return true
  }

  // 检查声明的权限列表
  return declaredPermissions.includes(permission)
}

/**
 * 要求插件具有指定权限，否则抛出错误
 * @param pluginPath 插件路径（用于判断内置插件）
 * @param permission 要检查的权限
 * @param declaredPermissions 插件声明的权限数组
 * @throws 如果插件没有该权限则抛出错误
 */
export function requirePermission(
  pluginPath: string,
  permission: PluginPermission,
  declaredPermissions: PluginPermission[]
): void {
  if (!checkPermission(pluginPath, permission, declaredPermissions)) {
    throw new Error(`Plugin at "${pluginPath}" does not have required permission: ${permission}`)
  }
}
