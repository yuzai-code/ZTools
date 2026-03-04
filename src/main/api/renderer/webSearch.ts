import { ipcMain, net } from 'electron'
import { randomUUID } from 'crypto'
import windowManager from '../../managers/windowManager'
import databaseAPI from '../shared/database'
import commandsAPI from './commands'

/**
 * 网页快开搜索引擎数据结构
 */
export interface WebSearchEngine {
  id: string // 唯一 ID (uuid)
  name: string // 搜索引擎名称
  url: string // URL 模板，{q} 为关键词占位符
  icon: string // favicon (base64 或 URL)
  enabled: boolean // 是否启用
}

/**
 * 网页快开 API
 */
class WebSearchAPI {
  private readonly DB_KEY = 'web-search-engines' // databaseAPI 会自动添加 ZTOOLS/ 前缀

  public init(): void {
    this.setupIPC()
  }

  private setupIPC(): void {
    ipcMain.handle('web-search:get-all', async () => {
      try {
        const engines = this.getAllEngines()
        return { success: true, data: engines }
      } catch (error: unknown) {
        console.error('[WebSearch] 获取搜索引擎列表失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })

    ipcMain.handle('web-search:add', async (_event, engine: WebSearchEngine) => {
      try {
        return await this.addEngine(engine)
      } catch (error: unknown) {
        console.error('[WebSearch] 添加搜索引擎失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })

    ipcMain.handle('web-search:update', async (_event, engine: WebSearchEngine) => {
      try {
        return await this.updateEngine(engine)
      } catch (error: unknown) {
        console.error('[WebSearch] 更新搜索引擎失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })

    ipcMain.handle('web-search:delete', async (_event, engineId: string) => {
      try {
        return await this.deleteEngine(engineId)
      } catch (error: unknown) {
        console.error('[WebSearch] 删除搜索引擎失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })

    ipcMain.handle('web-search:fetch-favicon', async (_event, url: string) => {
      try {
        const icon = await this.fetchFavicon(url)
        return { success: true, data: icon }
      } catch (error: unknown) {
        console.error('[WebSearch] 获取 favicon 失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })
  }

  /**
   * 获取所有搜索引擎
   */
  public getAllEngines(): WebSearchEngine[] {
    try {
      const data = databaseAPI.dbGet(this.DB_KEY)
      if (data && Array.isArray(data)) {
        return data
      }
      return []
    } catch {
      return []
    }
  }

  /**
   * 添加搜索引擎
   */
  public async addEngine(engine: WebSearchEngine): Promise<{ success: boolean; error?: string }> {
    if (!engine.name || !engine.url) {
      return { success: false, error: '名称和 URL 不能为空' }
    }
    if (!engine.url.includes('{q}')) {
      return { success: false, error: 'URL 必须包含 {q} 占位符' }
    }

    const engines = this.getAllEngines()

    // 自动生成 ID
    if (!engine.id) {
      engine.id = randomUUID()
    }

    // 检查重复 ID
    if (engines.some((e) => e.id === engine.id)) {
      return { success: false, error: '该搜索引擎 ID 已存在' }
    }

    // 默认启用
    if (engine.enabled === undefined) {
      engine.enabled = true
    }

    engines.push(engine)
    databaseAPI.dbPut(this.DB_KEY, engines)

    this.notifyCommandsChanged()

    return { success: true }
  }

  /**
   * 更新搜索引擎
   */
  public async updateEngine(engine: WebSearchEngine): Promise<{ success: boolean; error?: string }> {
    if (!engine.id || !engine.name || !engine.url) {
      return { success: false, error: '名称和 URL 不能为空' }
    }
    if (!engine.url.includes('{q}')) {
      return { success: false, error: 'URL 必须包含 {q} 占位符' }
    }

    const engines = this.getAllEngines()
    const index = engines.findIndex((e) => e.id === engine.id)
    if (index === -1) {
      return { success: false, error: '未找到该搜索引擎' }
    }

    engines[index] = engine
    databaseAPI.dbPut(this.DB_KEY, engines)

    this.notifyCommandsChanged()

    return { success: true }
  }

  /**
   * 删除搜索引擎
   */
  public async deleteEngine(engineId: string): Promise<{ success: boolean; error?: string }> {
    const engines = this.getAllEngines()
    const index = engines.findIndex((e) => e.id === engineId)
    if (index === -1) {
      return { success: false, error: '未找到该搜索引擎' }
    }

    engines.splice(index, 1)
    databaseAPI.dbPut(this.DB_KEY, engines)

    this.notifyCommandsChanged()

    return { success: true }
  }

  /**
   * 获取搜索引擎对应的插件 features（用于合并到系统插件）
   */
  public async getSearchEngineFeatures(): Promise<any[]> {
    const engines = this.getAllEngines()
    return engines
      .filter((e) => e.enabled)
      .map((e) => ({
        code: `web-search-${e.id}`,
        explain: e.name,
        icon: e.icon || '',
        cmds: [
          {
            type: 'over',
            label: e.name,
            minLength: 1
          }
        ]
      }))
  }

  /**
   * 根据 featureCode 获取搜索引擎配置
   */
  public async getEngineByFeatureCode(featureCode: string): Promise<WebSearchEngine | null> {
    const prefix = 'web-search-'
    if (!featureCode.startsWith(prefix)) {
      return null
    }
    const engineId = featureCode.substring(prefix.length)
    const engines = this.getAllEngines()
    return engines.find((e) => e.id === engineId) || null
  }

  /**
   * 获取网站 favicon
   * 解析目标网站 HTML，提取 <link rel="icon"> 标签获取 favicon URL，
   * 然后下载图标并转为 base64
   */
  public async fetchFavicon(url: string): Promise<string> {
    try {
      const urlObj = new URL(url.replace('{q}', 'test'))
      const origin = urlObj.origin

      // 先尝试请求网页获取 favicon link
      const html = await this.httpGet(`${origin}/`)
      const faviconUrl = this.parseFaviconFromHtml(html, origin)

      if (faviconUrl) {
        const base64 = await this.downloadAsBase64(faviconUrl)
        if (base64) return base64
      }

      // 回退到 /favicon.ico
      const fallbackBase64 = await this.downloadAsBase64(`${origin}/favicon.ico`)
      if (fallbackBase64) return fallbackBase64

      return ''
    } catch (error) {
      console.error('[WebSearch] fetchFavicon error:', error)
      return ''
    }
  }

  /**
   * 从 HTML 中解析 favicon URL
   */
  private parseFaviconFromHtml(html: string, origin: string): string {
    // 匹配 <link rel="icon" href="..."> 或 <link rel="shortcut icon" href="...">
    const linkRegex = /<link[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*href=["']([^"']+)["'][^>]*>/gi
    const altRegex = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*>/gi

    const match = linkRegex.exec(html) || altRegex.exec(html)
    if (match?.[1]) {
      const href = match[1]
      // 处理相对路径
      if (href.startsWith('//')) {
        return `https:${href}`
      } else if (href.startsWith('/')) {
        return `${origin}${href}`
      } else if (href.startsWith('http')) {
        return href
      } else {
        return `${origin}/${href}`
      }
    }

    return ''
  }

  /**
   * HTTP GET 请求，返回文本内容
   */
  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url)
      let data = ''
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          request.abort()
          reject(new Error('请求超时'))
        }
      }, 10000)

      request.on('response', (response) => {
        // 处理重定向
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          clearTimeout(timeout)
          resolved = true
          const location = Array.isArray(response.headers.location)
            ? response.headers.location[0]
            : response.headers.location
          this.httpGet(location).then(resolve).catch(reject)
          return
        }

        response.on('data', (chunk) => {
          data += chunk.toString()
          // 只读取前 100KB，足够解析 head 中的 favicon
          if (data.length > 100 * 1024) {
            clearTimeout(timeout)
            if (!resolved) {
              resolved = true
              request.abort()
              resolve(data)
            }
          }
        })
        response.on('end', () => {
          clearTimeout(timeout)
          if (!resolved) {
            resolved = true
            resolve(data)
          }
        })
        response.on('error', (error) => {
          clearTimeout(timeout)
          if (!resolved) {
            resolved = true
            reject(error)
          }
        })
      })

      request.on('error', (error) => {
        clearTimeout(timeout)
        if (!resolved) {
          resolved = true
          reject(error)
        }
      })

      request.end()
    })
  }

  /**
   * 下载 URL 内容并转为 base64
   */
  private downloadAsBase64(url: string): Promise<string> {
    return new Promise((resolve) => {
      const request = net.request(url)
      const chunks: Buffer[] = []
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          request.abort()
          resolve('')
        }
      }, 10000)

      request.on('response', (response) => {
        // 处理重定向
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          clearTimeout(timeout)
          resolved = true
          const location = Array.isArray(response.headers.location)
            ? response.headers.location[0]
            : response.headers.location
          this.downloadAsBase64(location).then(resolve)
          return
        }

        if (response.statusCode !== 200) {
          clearTimeout(timeout)
          if (!resolved) {
            resolved = true
            resolve('')
          }
          return
        }

        const contentType =
          (Array.isArray(response.headers['content-type'])
            ? response.headers['content-type'][0]
            : response.headers['content-type']) || 'image/x-icon'

        response.on('data', (chunk) => {
          chunks.push(Buffer.from(chunk))
        })
        response.on('end', () => {
          clearTimeout(timeout)
          if (!resolved) {
            resolved = true
            const buffer = Buffer.concat(chunks)
            if (buffer.length > 0) {
              const mimeType = contentType.split(';')[0].trim()
              resolve(`data:${mimeType};base64,${buffer.toString('base64')}`)
            } else {
              resolve('')
            }
          }
        })
        response.on('error', () => {
          clearTimeout(timeout)
          if (!resolved) {
            resolved = true
            resolve('')
          }
        })
      })

      request.on('error', () => {
        clearTimeout(timeout)
        if (!resolved) {
          resolved = true
          resolve('')
        }
      })

      request.end()
    })
  }

  /**
   * 通知前端命令列表已变化
   */
  private notifyCommandsChanged(): void {
    // 清除 commands 缓存
    ;(commandsAPI as any).cachedCommandsResult = null

    // 通知渲染进程
    const mainWindow = windowManager.getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('plugins-changed')
    }
  }
}

export default new WebSearchAPI()
