import { createClient, WebDAVClient } from 'webdav'
import { SyncConfig, RemoteFileMeta, RemotePluginManifest } from './types'

/**
 * WebDAV 同步客户端
 */
export class WebDAVSyncClient {
  private client: WebDAVClient | null = null

  /**
   * 初始化 WebDAV 客户端
   */
  async init(config: SyncConfig): Promise<void> {
    this.client = createClient(config.serverUrl, {
      username: config.username,
      password: config.password
    })

    // 测试连接
    await this.testConnection()

    // 确保远程目录存在
    await this.ensureRemoteDirectory()
  }

  /**
   * 测试 WebDAV 连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    try {
      await this.client.getDirectoryContents('/')
      return true
    } catch (error: any) {
      throw new Error('WebDAV 连接失败: ' + error.message)
    }
  }

  /**
   * 确保远程目录存在
   */
  private async ensureRemoteDirectory(): Promise<void> {
    if (!this.client) return

    const remotePath = '/ztools-sync'
    const exists = await this.client.exists(remotePath)
    if (!exists) {
      await this.client.createDirectory(remotePath)
    }

    // 确保附件目录存在
    const attachmentPath = '/ztools-sync/attachments'
    const attachmentExists = await this.client.exists(attachmentPath)
    if (!attachmentExists) {
      await this.client.createDirectory(attachmentPath)
    }

    // 确保插件目录存在
    const pluginsPath = '/ztools-sync/plugins'
    const pluginsExists = await this.client.exists(pluginsPath)
    if (!pluginsExists) {
      await this.client.createDirectory(pluginsPath)
    }
  }

  /**
   * 上传文档到云端
   */
  async uploadDoc(doc: any): Promise<void> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    // 使用 URL 编码避免路径问题（/ 会被编码为 %2F）
    const safeDocId = encodeURIComponent(doc._id)
    const remotePath = `/ztools-sync/${safeDocId}.json`
    const content = JSON.stringify(doc, null, 2)

    try {
      await this.client.putFileContents(remotePath, content, {
        overwrite: true
      })
    } catch (error: any) {
      console.error(`[WebDAV] 上传文档失败: ${doc._id}`, error.message)
      throw error
    }
  }

  /**
   * 从云端下载文档
   */
  async downloadDoc(docId: string): Promise<any | null> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    // 使用 URL 编码避免路径问题
    const safeDocId = encodeURIComponent(docId)
    const remotePath = `/ztools-sync/${safeDocId}.json`
    const exists = await this.client.exists(remotePath)
    if (!exists) return null

    const content = (await this.client.getFileContents(remotePath, {
      format: 'text'
    })) as string
    return JSON.parse(content)
  }

  /**
   * 获取云端文档列表（包含元数据）
   */
  async listRemoteDocsWithMeta(): Promise<RemoteFileMeta[]> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    const response = await this.client.getDirectoryContents('/ztools-sync', {
      details: true
    })

    // 当 details: true 时，返回的是 { data: FileStat[] } 格式
    const contents = Array.isArray(response) ? response : (response as any).data

    if (!Array.isArray(contents)) {
      console.error('[WebDAV] getDirectoryContents 返回格式异常:', response)
      return []
    }

    return contents
      .filter((item) => item.type === 'file' && item.filename.endsWith('.json'))
      .map((item) => {
        // 从文件名解码得到原始 docId
        const encodedDocId = item.basename.replace('.json', '')
        const docId = decodeURIComponent(encodedDocId)
        return {
          docId,
          lastModified: new Date(item.lastmod).getTime()
        }
      })
  }

  /**
   * 删除云端文档
   */
  async deleteDoc(docId: string): Promise<void> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    // 使用 URL 编码避免路径问题
    const safeDocId = encodeURIComponent(docId)
    const remotePath = `/ztools-sync/${safeDocId}.json`
    await this.client.deleteFile(remotePath)
  }

  /**
   * 上传附件到云端
   */
  async uploadAttachment(docId: string, data: Buffer, metadata?: any): Promise<void> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    // 使用 URL 编码避免路径问题（/ 会被编码为 %2F，: 会被编码为 %3A）
    const safeDocId = encodeURIComponent(docId)

    // 上传二进制数据
    const dataPath = `/ztools-sync/attachments/${safeDocId}.bin`
    await this.client.putFileContents(dataPath, data, {
      overwrite: true
    })

    // 上传元数据（如果提供）
    if (metadata) {
      const metaPath = `/ztools-sync/attachments/${safeDocId}.meta.json`
      await this.client.putFileContents(metaPath, JSON.stringify(metadata, null, 2), {
        overwrite: true
      })
    }
  }

  /**
   * 从云端下载附件
   */
  async downloadAttachment(docId: string): Promise<{ data: Buffer; metadata?: any } | null> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    // 使用 URL 编码避免路径问题
    const safeDocId = encodeURIComponent(docId)
    const dataPath = `/ztools-sync/attachments/${safeDocId}.bin`
    const metaPath = `/ztools-sync/attachments/${safeDocId}.meta.json`

    // 检查二进制数据是否存在
    const dataExists = await this.client.exists(dataPath)
    if (!dataExists) return null

    // 下载二进制数据
    const data = (await this.client.getFileContents(dataPath, {
      format: 'binary'
    })) as Buffer

    // 尝试下载元数据
    let metadata: any = undefined
    try {
      const metaExists = await this.client.exists(metaPath)
      if (metaExists) {
        const metaContent = (await this.client.getFileContents(metaPath, {
          format: 'text'
        })) as string
        metadata = JSON.parse(metaContent)
      }
    } catch (error) {
      console.warn(`[WebDAV] 下载附件元数据失败: ${docId}`, error)
    }

    return { data, metadata }
  }

  /**
   * 删除云端附件
   */
  async deleteAttachment(docId: string): Promise<void> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    // 使用 URL 编码避免路径问题
    const safeDocId = encodeURIComponent(docId)
    const remotePath = `/ztools-sync/attachments/${safeDocId}.bin`
    const exists = await this.client.exists(remotePath)
    if (exists) {
      await this.client.deleteFile(remotePath)
    }
  }

  /**
   * 获取云端附件列表
   */
  async listRemoteAttachments(): Promise<string[]> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    const response = await this.client.getDirectoryContents('/ztools-sync/attachments', {
      details: true
    })

    // 当 details: true 时，返回的是 { data: FileStat[] } 格式
    const contents = Array.isArray(response) ? response : (response as any).data

    if (!Array.isArray(contents)) {
      console.error('[WebDAV] getDirectoryContents 返回格���异常:', response)
      return []
    }

    return contents
      .filter((item) => item.type === 'file' && item.filename.endsWith('.bin'))
      .map((item) => {
        // 从文件名解码得到原始 attachmentId
        const encodedId = item.basename.replace('.bin', '')
        return decodeURIComponent(encodedId)
      })
  }

  // ==================== 插件同步相关方法 ====================

  /**
   * 上传插件 zip 到云端
   */
  async uploadPluginZip(pluginName: string, zipBuffer: Buffer): Promise<void> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    const encoded = encodeURIComponent(pluginName)
    const remotePath = `/ztools-sync/plugins/${encoded}.zip`

    try {
      await this.client.putFileContents(remotePath, zipBuffer, {
        overwrite: true
      })
    } catch (error: any) {
      console.error(`[WebDAV] 上传插件 zip 失败: ${pluginName}`, error.message)
      throw error
    }
  }

  /**
   * 从云端下载插件 zip
   */
  async downloadPluginZip(pluginName: string): Promise<Buffer | null> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    const encoded = encodeURIComponent(pluginName)
    const remotePath = `/ztools-sync/plugins/${encoded}.zip`
    const exists = await this.client.exists(remotePath)
    if (!exists) return null

    const data = (await this.client.getFileContents(remotePath, {
      format: 'binary'
    })) as Buffer

    return Buffer.from(data)
  }

  /**
   * 删除云端插件 zip
   */
  async deletePluginZip(pluginName: string): Promise<void> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    const encoded = encodeURIComponent(pluginName)
    const remotePath = `/ztools-sync/plugins/${encoded}.zip`
    const exists = await this.client.exists(remotePath)
    if (exists) {
      await this.client.deleteFile(remotePath)
    }
  }

  /**
   * 上传插件清单到云端
   */
  async uploadPluginManifest(manifest: RemotePluginManifest): Promise<void> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    const remotePath = '/ztools-sync/plugins/manifest.json'
    const content = JSON.stringify(manifest, null, 2)

    await this.client.putFileContents(remotePath, content, {
      overwrite: true
    })
  }

  /**
   * 从云端下载插件清单
   */
  async downloadPluginManifest(): Promise<RemotePluginManifest> {
    if (!this.client) {
      throw new Error('WebDAV 客户端未初始化')
    }

    const remotePath = '/ztools-sync/plugins/manifest.json'
    const exists = await this.client.exists(remotePath)
    if (!exists) return {}

    try {
      const content = (await this.client.getFileContents(remotePath, {
        format: 'text'
      })) as string
      return JSON.parse(content)
    } catch (error) {
      console.warn('[WebDAV] 解析插件清单失败:', error)
      return {}
    }
  }
}
