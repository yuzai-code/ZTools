import chokidar, { FSWatcher } from 'chokidar'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const PLUGIN_DIR = path.join(app.getPath('userData'), 'plugins')

/**
 * 插件同步监视器
 * 监听插件目录变更，仅标记脏数据，不执行重操作（hash/zip 在同步时处理）
 */
class PluginSyncWatcher {
  private watcher: FSWatcher | null = null
  private dirtyPlugins: Set<string> = new Set()
  private paused = false

  /**
   * 启动监听
   */
  start(): void {
    if (this.watcher) {
      return
    }

    // 确保插件目录存在
    if (!fs.existsSync(PLUGIN_DIR)) {
      fs.mkdirSync(PLUGIN_DIR, { recursive: true })
    }

    console.log('[PluginSyncWatcher] 开始监听插件目录:', PLUGIN_DIR)

    // 初始全量标脏
    this.markAllDirty()

    this.watcher = chokidar.watch(PLUGIN_DIR, {
      depth: 5,
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      usePolling: process.platform === 'win32',
      interval: process.platform === 'win32' ? 5000 : undefined,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    })

    // 标脏操作是幂等的 Set.add()，无需防抖，直接标记
    const handleChange = (changedPath: string): void => {
      if (this.paused) return

      const relativePath = path.relative(PLUGIN_DIR, changedPath)
      const pluginName = relativePath.split(path.sep)[0]
      if (!pluginName || pluginName === '.') return

      this.dirtyPlugins.add(pluginName)
      console.log(`[PluginSyncWatcher] 标记脏插件: ${pluginName}`)
    }

    this.watcher.on('add', handleChange)
    this.watcher.on('change', handleChange)
    this.watcher.on('unlink', handleChange)
    this.watcher.on('addDir', handleChange)
    this.watcher.on('unlinkDir', handleChange)

    this.watcher.on('error', (error: unknown) => {
      console.error('[PluginSyncWatcher] 监听错误:', error)
    })

    this.watcher.on('ready', () => {
      console.log('[PluginSyncWatcher] 监听器已就绪')
    })
  }

  /**
   * 停止监听并清理
   */
  stop(): void {
    if (this.watcher) {
      console.log('[PluginSyncWatcher] 停止监听')
      this.watcher.close()
      this.watcher = null
    }
    this.dirtyPlugins.clear()
  }

  /**
   * 获取当前脏插件集合
   */
  getDirtyPlugins(): Set<string> {
    return new Set(this.dirtyPlugins)
  }

  /**
   * 清除单个插件的脏标记
   */
  clearDirty(pluginName: string): void {
    this.dirtyPlugins.delete(pluginName)
  }

  /**
   * 将所有现有插件标记为脏
   */
  markAllDirty(): void {
    if (!fs.existsSync(PLUGIN_DIR)) return

    try {
      const entries = fs.readdirSync(PLUGIN_DIR, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          this.dirtyPlugins.add(entry.name)
        }
      }
      console.log(`[PluginSyncWatcher] 初始标脏 ${this.dirtyPlugins.size} 个插件`)
    } catch (error) {
      console.error('[PluginSyncWatcher] 标记所有插件为脏失败:', error)
    }
  }

  /**
   * 暂停监听（同步引擎安装/卸载插件时使用）
   */
  pause(): void {
    this.paused = true
  }

  /**
   * 恢复监听
   */
  resume(): void {
    this.paused = false
  }
}

export default new PluginSyncWatcher()
