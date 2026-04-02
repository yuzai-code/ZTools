/**
 * Toast 窗口 Preload 脚本
 * 使用 contextBridge 安全暴露 IPC API
 */
const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('toastAPI', {
  // 接收 toast 更新消息
  onUpdateToasts: (callback) => {
    ipcRenderer.on('update-toasts', (_event, toasts) => callback(toasts))
  }
})
