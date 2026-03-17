import { BrowserWindow, ipcMain } from 'electron'
import { SyncEngine } from '../../core/sync/syncEngine'
import { SyncConfig } from '../../core/sync/types'
import lmdbInstance from '../../core/lmdb/lmdbInstance'
import { safeStorage } from 'electron'
import pluginDeviceAPI from '../plugin/device'
import { WebDAVSyncClient } from '../../core/sync/webdavClient'
import pluginSyncWatcher from '../../core/sync/pluginSyncWatcher'

/**
 * 同步 API
 */
export class SyncAPI {
  private syncEngine: SyncEngine | null = null

  public init(mainWindow?: BrowserWindow): void {
    this.syncEngine = new SyncEngine(lmdbInstance)
    if (mainWindow) {
      this.syncEngine.setMainWindow(mainWindow)
    }
    this.setupIPC()

    // 应用启动时初始化同步引擎
    this.syncEngine.init().catch((error) => {
      console.error('[Sync API] 初始化失败:', error)
    })
  }

  private setupIPC(): void {
    // 测试 WebDAV 连接
    ipcMain.handle('sync:test-connection', async (_event, config: SyncConfig) => {
      try {
        const client = new WebDAVSyncClient()
        await client.init(config)
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 保存同步配置
    ipcMain.handle('sync:save-config', async (_event, config: SyncConfig) => {
      try {
        // 生成设备 ID（如果没有）
        if (!config.deviceId) {
          config.deviceId = pluginDeviceAPI.getDeviceIdPublic()
        }

        // 加密密码
        if (config.password && safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(config.password)
          config.password = encrypted.toString('base64')
        }

        await this.syncEngine!.saveSyncConfig(config)

        // 重新初始化同步引擎
        if (config.enabled) {
          await this.syncEngine!.init()
        } else {
          this.syncEngine!.stopAutoSync()
        }

        // 管理插件同步监听器生命周期
        if (config.enabled && config.syncPlugins) {
          pluginSyncWatcher.start()
        } else {
          pluginSyncWatcher.stop()
        }

        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 获取同步配置
    ipcMain.handle('sync:get-config', async () => {
      try {
        const doc = await lmdbInstance.promises.get('SYNC/config')
        if (!doc?.data) {
          return { success: true, config: null }
        }

        const config = doc.data as SyncConfig

        // 解密密码
        if (config.password && safeStorage.isEncryptionAvailable()) {
          try {
            const buffer = Buffer.from(config.password, 'base64')
            config.password = safeStorage.decryptString(buffer)
          } catch (error) {
            console.error('[Sync API] 解密密码失败:', error)
          }
        }

        return { success: true, config }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 立即同步
    ipcMain.handle('sync:perform-sync', async () => {
      try {
        const result = await this.syncEngine!.performSync()
        return { success: true, result }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 强制从云端同步到本地
    ipcMain.handle('sync:force-download-from-cloud', async () => {
      try {
        const result = await this.syncEngine!.forceDownloadFromCloud()
        return { success: true, result }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 停止自动同步
    ipcMain.handle('sync:stop-auto-sync', async () => {
      try {
        this.syncEngine!.stopAutoSync()
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })

    // 获取未同步文档数量
    ipcMain.handle('sync:get-unsynced-count', async () => {
      try {
        // 同步白名单（不包括 command-history 和 pinned-commands 以保护隐私）
        const syncPrefixes = ['ZTOOLS/settings-general', 'PLUGIN/']
        let count = 0

        for (const prefix of syncPrefixes) {
          const docs = await lmdbInstance.promises.allDocs(prefix)

          for (const doc of docs) {
            // 从 metaDb 获取同步状态
            const meta = await lmdbInstance.promises.getSyncMeta(doc._id)

            // 如果没有同步元数据，或者 _cloudSynced !== true，则视为未同步
            if (!meta || meta._cloudSynced !== true) {
              count++
            }
          }
        }

        return { success: true, count }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })
  }
}

export default new SyncAPI()
