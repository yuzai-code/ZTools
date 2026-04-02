import { describe, it, expect } from 'vitest'
import {
  isInternalPlugin,
  getPluginPermissions,
  checkPermission,
  requirePermission,
  PluginInfo
} from '../../src/main/utils/pluginPermissionCheck'
import { PluginPermission } from '../../src/main/types/pluginPermissions'

describe('pluginPermissionCheck', () => {
  describe('isInternalPlugin', () => {
    it('应返回 true 表示 setting 是内置插件', () => {
      expect(isInternalPlugin('setting')).toBe(true)
    })

    it('应返回 true 表示 system 是内置插件', () => {
      expect(isInternalPlugin('system')).toBe(true)
    })

    it('应从完整路径中提取插件名并返回 true', () => {
      expect(isInternalPlugin('/path/to/internal-plugins/setting')).toBe(true)
    })

    it('应从完整路径中提取插件名并返回 true（system）', () => {
      expect(isInternalPlugin('/some/path/internal-plugins/system')).toBe(true)
    })

    it('应返回 false 表示第三方插件不是内置插件', () => {
      expect(isInternalPlugin('some-third-party-plugin')).toBe(false)
    })

    it('应返回 false 表示任意第三方插件路径', () => {
      expect(isInternalPlugin('/plugins/my-custom-plugin')).toBe(false)
    })
  })

  describe('getPluginPermissions', () => {
    it('应从插件信息中返回权限数组', () => {
      const pluginInfo: PluginInfo = {
        name: 'test-plugin',
        permissions: ['clipboard:read', 'file:read']
      }
      expect(getPluginPermissions(pluginInfo)).toEqual(['clipboard:read', 'file:read'])
    })

    it('应返回空数组当没有声明权限时', () => {
      const pluginInfo: PluginInfo = {
        name: 'test-plugin'
      }
      expect(getPluginPermissions(pluginInfo)).toEqual([])
    })

    it('应返回空数组当 permissions 为 undefined', () => {
      const pluginInfo: PluginInfo = {
        name: 'test-plugin',
        permissions: undefined
      }
      expect(getPluginPermissions(pluginInfo)).toEqual([])
    })
  })

  describe('checkPermission', () => {
    it('内置插件应拥有所有权限', () => {
      expect(checkPermission('setting', 'shell:open-path', [])).toBe(true)
      expect(checkPermission('system', 'input:simulate', [])).toBe(true)
      expect(checkPermission('/path/to/setting', 'file:write', [])).toBe(true)
      expect(checkPermission('/path/to/system', 'system:process', [])).toBe(true)
    })

    it('应返回 true 当插件声明了所需权限', () => {
      const permissions: PluginPermission[] = ['clipboard:read', 'file:read']
      expect(checkPermission('/path/to/plugin', 'clipboard:read', permissions)).toBe(true)
    })

    it('应返回 false 当插件未声明所需权限', () => {
      const permissions: PluginPermission[] = ['clipboard:read']
      expect(checkPermission('/path/to/plugin', 'shell:open-path', permissions)).toBe(false)
    })

    it('第三方插件未声明任何权限时应返回 false', () => {
      expect(checkPermission('/path/to/third-party', 'clipboard:read', [])).toBe(false)
    })
  })

  describe('requirePermission', () => {
    it('内置插件调用 requirePermission 不应抛出错误', () => {
      expect(() => {
        requirePermission('setting', 'shell:open-path', [])
      }).not.toThrow()
    })

    it('有权限的插件调用 requirePermission 不应抛出错误', () => {
      expect(() => {
        requirePermission('/path/to/plugin', 'clipboard:read', ['clipboard:read'])
      }).not.toThrow()
    })

    it('无权限的插件调用 requirePermission 应抛出错误', () => {
      expect(() => {
        requirePermission('/path/to/plugin', 'shell:open-path', ['clipboard:read'])
      }).toThrow('Plugin at "/path/to/plugin" does not have required permission: shell:open-path')
    })

    it('错误信息应包含插件路径和所需权限', () => {
      try {
        requirePermission('/my/plugin/path', 'input:simulate', [])
        expect.fail('Expected error to be thrown')
      } catch (error) {
        expect((error as Error).message).toContain('/my/plugin/path')
        expect((error as Error).message).toContain('input:simulate')
      }
    })
  })
})
