/**
 * 悬浮球窗口 Preload 脚本
 * 使用 contextBridge 安全暴露 IPC API
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron')
const path = require('path')
const fs = require('fs')

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('floatingBallAPI', {
  // 发送 IPC 消息
  send: (channel, data) => {
    const validChannels = [
      'floating-ball-click',
      'floating-ball-double-click',
      'floating-ball-drag-start',
      'floating-ball-dragging',
      'floating-ball-drag-end',
      'floating-ball-contextmenu',
      'floating-ball-file-drop'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  // 接收 IPC 消息
  on: (channel, callback) => {
    const validChannels = ['floating-ball-set-letter']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },

  // 获取文件路径（安全封装 webUtils.getPathForFile）
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return null
    }
  },

  // 获取文件信息（安全封装 fs.statSync + path.basename）
  getFileInfo: (filePath) => {
    try {
      const stat = fs.statSync(filePath)
      return {
        path: filePath,
        name: path.basename(filePath),
        isDirectory: stat.isDirectory()
      }
    } catch {
      return null
    }
  }
})
