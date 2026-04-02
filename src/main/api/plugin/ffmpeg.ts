import { registerPluginApiServices } from './pluginApiDispatcher'
import ffmpegManager from '../../core/ffmpeg'
import { spawn } from 'child_process'

class PluginFFmpegAPI {
  public init(): void {
    registerPluginApiServices({
      getFFmpegPath: async () => {
        return await ffmpegManager.ensureFFmpeg()
      },

      // 在主进程中运行 FFmpeg（用于 contextIsolation 模式）
      'ffmpeg:run': async (
        _event,
        { args, options }: { args: string[]; options?: { onProgress?: boolean } }
      ) => {
        const ffmpegPath = await ffmpegManager.ensureFFmpeg()

        return new Promise((resolve, reject) => {
          const proc = spawn(ffmpegPath, args, {
            stdio: ['pipe', 'ignore', 'pipe']
          })

          const MAX_ERROR_LINES = 5
          const lines: string[] = []
          let totalDuration: number | null = null
          let progressData: Record<string, unknown>[] = []

          proc.stderr.on('data', (data) => {
            const text = data.toString()
            const trimmed = text.trim()

            // 解析总时长
            if (totalDuration === null) {
              const m = trimmed.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/)
              if (m) {
                totalDuration =
                  3600 * parseInt(m[1], 10) + 60 * parseInt(m[2], 10) + parseFloat(m[3])
              }
            }

            // 解析进度
            if (/time=\d+:\d{2}:\d{2}/.test(trimmed)) {
              const info: Record<string, unknown> = {}
              trimmed.split(/(?<!(?:=|\s))\s/).forEach((pair) => {
                const kv = pair.split('=')
                if (kv.length === 2) {
                  const v = kv[1].trim()
                  info[kv[0].trim()] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v
                }
              })
              if (info.time && totalDuration) {
                const tp = (info.time as string).split(':')
                const cur =
                  3600 * parseInt(tp[0], 10) + 60 * parseInt(tp[1], 10) + parseFloat(tp[2])
                info.percent = (cur / totalDuration) * 100
              }
              if (options?.onProgress) {
                progressData.push(info)
              }
            } else {
              lines.push(text)
              if (lines.length > MAX_ERROR_LINES) lines.shift()
            }
          })

          proc.on('close', (code) => {
            if (code !== 0) {
              const combined = lines.join('').trim()
              const errs = combined
                .split('\n')
                .filter((l) => /error|invalid|failed|no such file|unable/i.test(l))
                .map((l) => l.replace(/^\[[^\]]+ @ [^\]]+\]\s*/, '').trim())
              const msg = errs.length === 0 ? combined : errs.join('\n')
              reject(new Error(msg || `ffmpeg process exited with code ${code}`))
            } else {
              resolve({ success: true, progress: progressData })
            }
          })

          proc.on('error', (err) => {
            reject(err)
          })
        })
      }
    })
  }
}

export default new PluginFFmpegAPI()
