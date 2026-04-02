import { registerPluginApiServices } from './pluginApiDispatcher'
import sharp from 'sharp'

class PluginSharpAPI {
  public init(): void {
    registerPluginApiServices({
      // 在主进程中运行 Sharp（用于 contextIsolation 模式）
      'sharp:process': async (
        _event,
        { input, options }: { input: string | Buffer; options?: Record<string, unknown> }
      ) => {
        try {
          let instance: sharp.Sharp

          if (Buffer.isBuffer(input)) {
            instance = sharp(input, options as sharp.SharpOptions)
          } else if (typeof input === 'string') {
            // 输入是文件路径或 base64
            if (input.startsWith('')) {
              // Base64 data URL
              const base64Data = input.split(',')[1]
              const buffer = Buffer.from(base64Data, 'base64')
              instance = sharp(buffer, options as sharp.SharpOptions)
            } else {
              // 文件路径
              instance = sharp(input, options as sharp.SharpOptions)
            }
          } else {
            throw new Error('Invalid input type for sharp')
          }

          // 获取输出信息
          const { data, info } = await instance.png().toBuffer({ resolveWithObject: true })

          return {
            success: true,
            data: data.toString('base64'),
            info: {
              width: info.width,
              height: info.height,
              channels: info.channels,
              size: info.size
            }
          }
        } catch (error) {
          console.error('[Sharp] Processing error:', error)
          throw error
        }
      }
    })
  }
}

export default new PluginSharpAPI()
