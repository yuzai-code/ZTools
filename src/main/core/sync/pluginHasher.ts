import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { PluginHashMap } from './types'

const STAGING_DIR = path.join(app.getPath('userData'), 'plugin-sync')
const HASH_RECORDS_FILE = path.join(STAGING_DIR, 'hash-records.json')

/**
 * 递归获取目录下所有文件的相对路径（已排序）
 */
function getAllFiles(dir: string, baseDir: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, baseDir))
    } else if (entry.isFile()) {
      results.push(path.relative(baseDir, fullPath).replace(/\\/g, '/'))
    }
  }

  return results.sort()
}

/**
 * 计算插件目录的确定性哈希
 * 递归读取所有文件，排序路径后用 SHA-256 生成哈希
 */
export function computePluginHash(pluginDir: string): string {
  const hash = crypto.createHash('sha256')
  const files = getAllFiles(pluginDir, pluginDir)

  for (const relativePath of files) {
    hash.update(relativePath)
    const content = fs.readFileSync(path.join(pluginDir, relativePath))
    hash.update(content)
  }

  return hash.digest('hex')
}

/**
 * 加载本地哈希记录
 */
export function loadHashRecords(): PluginHashMap {
  try {
    if (fs.existsSync(HASH_RECORDS_FILE)) {
      const content = fs.readFileSync(HASH_RECORDS_FILE, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error('[PluginHasher] 加载哈希记录失败:', error)
  }
  return {}
}

/**
 * 保存本地哈希记录
 */
export function saveHashRecords(records: PluginHashMap): void {
  try {
    ensureStagingDir()
    fs.writeFileSync(HASH_RECORDS_FILE, JSON.stringify(records, null, 2), 'utf-8')
  } catch (error) {
    console.error('[PluginHasher] 保存哈希记录失败:', error)
  }
}

/**
 * 确保 zip 暂存目录存在
 */
function ensureStagingDir(): void {
  if (!fs.existsSync(STAGING_DIR)) {
    fs.mkdirSync(STAGING_DIR, { recursive: true })
  }
}

/**
 * 获取 zip 暂存目录路径
 */
export function getZipStagingDir(): string {
  ensureStagingDir()
  return STAGING_DIR
}

/**
 * 获取插件 zip 文件路径
 */
export function getZipPath(pluginName: string): string {
  return path.join(getZipStagingDir(), `${pluginName}.zip`)
}
