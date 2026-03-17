/**
 * WebDAV 同步相关类型定义
 */

/**
 * 同步配置
 */
export interface SyncConfig {
  enabled: boolean // 是否启用同步
  serverUrl: string // WebDAV 服务器地址
  username: string // 用户名
  password: string // 密码（加密存储）
  syncInterval: number // 同步间隔（秒）
  lastSyncTime: number // 最后同步时间
  deviceId: string // 当前设备唯一 ID（自动生成）
  syncPlugins?: boolean // 是否同步插件文件
}

/**
 * 同步队列项
 */
export interface SyncQueueItem {
  docId: string
  operation: 'put' | 'remove'
  timestamp: number
  retryCount: number
}

/**
 * 冲突记录
 */
export interface ConflictRecord {
  docId: string
  localDoc: any
  remoteDoc: any
  timestamp: number
}

/**
 * 同步结果
 */
export interface SyncResult {
  uploaded: number // 上传数量
  downloaded: number // 下载数量
  conflicts: number // 冲突数量
  errors: number // 错误数量
  pluginsUploaded?: number // 上传插件数量
  pluginsDownloaded?: number // 下载插件数量
  pluginsDeleted?: number // 删除插件数量
}

/**
 * 插件哈希记录
 */
export interface PluginHashRecord {
  hash: string
  version: string
  lastSyncTime: number
}

/**
 * 插件哈希映射
 */
export interface PluginHashMap {
  [pluginName: string]: PluginHashRecord
}

/**
 * 远端插件清单条目
 */
export interface RemotePluginManifestEntry {
  hash: string
  version: string
  lastModified: number
  deviceId: string
}

/**
 * 远端插件清单
 */
export interface RemotePluginManifest {
  [pluginName: string]: RemotePluginManifestEntry
}

/**
 * 远程文件元数据
 */
export interface RemoteFileMeta {
  docId: string
  lastModified: number
}
