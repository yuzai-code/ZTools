import { describe, expect, it } from 'vitest'
import {
  BUNDLED_INTERNAL_PLUGIN_NAMES,
  INTERNAL_API_PLUGIN_NAMES,
  canPluginUseInternalApi,
  isBundledInternalPlugin
} from '../../src/main/core/internalPlugins'

describe('internal plugin privilege split', () => {
  it('应将开发者插件识别为仅拥有内部 API 权限', () => {
    expect(INTERNAL_API_PLUGIN_NAMES).toContain('zTools-developer-plugin')
    expect(BUNDLED_INTERNAL_PLUGIN_NAMES).not.toContain('zTools-developer-plugin')
    expect(canPluginUseInternalApi('zTools-developer-plugin')).toBe(true)
    expect(isBundledInternalPlugin('zTools-developer-plugin')).toBe(false)
  })
})
