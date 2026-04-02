/**
 * 插件 Preload 脚本 - 使用 contextBridge 安全暴露 API
 *
 * 此文件是 preload.js 的安全重构版本，遵循 Electron 安全最佳实践：
 * - 使用 contextBridge.exposeInMainWorld 暴露 API
 * - 不直接在渲染进程中使用 require()
 * - 回调函数通过 IPC 事件订阅模式实现
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron')

// ── IPC 公共方法 ──

/**
 * 同步 IPC 调用 - 通过 plugin.api 通道发送同步消息
 */
const ipcSendSync = (apiName, args) => {
  const result = ipcRenderer.sendSync('plugin.api', apiName, args)
  if (result instanceof Error) throw result
  return result
}

/**
 * 异步 IPC 调用 - 通过 plugin.api 通道发送异步消息
 */
const ipcInvoke = async (apiName, args) => {
  try {
    return await ipcRenderer.invoke('plugin.api', apiName, args)
  } catch (e) {
    throw new Error(e.message.replace(/^.*?Error:/, '').trim())
  }
}

/**
 * 单向 IPC 发送
 */
const ipcSend = (apiName, args) => {
  ipcRenderer.send('plugin.api', apiName, args)
}

// ── 回调管理 ──
// contextBridge 不支持直接传递回调函数，使用 IPC 事件订阅模式

const callbacks = {
  enter: null,
  clipboardChange: null,
  subInputChange: null,
  pluginOut: null,
  pluginDetach: null,
  mainPush: { callback: null, selectCallback: null },
  hotkeyRecorded: null,
  windowMaterialChange: null,
  logEntries: null,
  foundInPage: null
}

// 插件侧注册的 MCP 工具处理器
const registeredTools = new Map()

// ── IPC 事件监听器注册 ──

// 插件进入事件
ipcRenderer.on('on-plugin-enter', (_event, launchParam) => {
  if (callbacks.enter) {
    callbacks.enter(launchParam)
  }
})

// 剪贴板变化事件
ipcRenderer.on('clipboard-change', (_event, item) => {
  if (callbacks.clipboardChange) callbacks.clipboardChange(item)
})

// 子输入框变化事件
ipcRenderer.on('sub-input-change', (_event, details) => {
  if (callbacks.subInputChange) callbacks.subInputChange(details)
})

// 插件退出事件
ipcRenderer.on('plugin-out', (_event, isKill) => {
  if (callbacks.pluginOut) callbacks.pluginOut(isKill)
})

// 插件分离事件
ipcRenderer.on('plugin-detach', () => {
  if (callbacks.pluginDetach) callbacks.pluginDetach()
})

// mainPush 查询请求
ipcRenderer.on('main-push-query', (event, { queryData, callId }) => {
  try {
    let allResults = []
    if (callbacks.mainPush.callback) {
      const results = callbacks.mainPush.callback(queryData)
      if (Array.isArray(results) && results.length > 0) {
        allResults = allResults.concat(results)
      }
    }
    ipcRenderer.send(`main-push-result-${callId}`, { success: true, results: allResults })
  } catch (error) {
    ipcRenderer.send(`main-push-result-${callId}`, { success: false, error: error.message })
  }
})

// mainPush 选择事件
ipcRenderer.on('main-push-select', (event, { selectData, callId }) => {
  try {
    let shouldEnterPlugin = false
    if (callbacks.mainPush.selectCallback) {
      const result = callbacks.mainPush.selectCallback(selectData)
      if (result === true) shouldEnterPlugin = true
    }
    ipcRenderer.send(`main-push-select-result-${callId}`, { success: true, shouldEnterPlugin })
  } catch (error) {
    ipcRenderer.send(`main-push-select-result-${callId}`, { success: false, error: error.message })
  }
})

// 快捷键录制事件
ipcRenderer.on('hotkey-recorded', (_event, shortcut) => {
  if (callbacks.hotkeyRecorded) callbacks.hotkeyRecorded(shortcut)
})

// 窗口材质更新事件
ipcRenderer.on('update-window-material', (_event, material) => {
  if (callbacks.windowMaterialChange) callbacks.windowMaterialChange(material)
})

// 调试日志推送事件
ipcRenderer.on('log-entries', (_event, entries) => {
  if (callbacks.logEntries) callbacks.logEntries(entries)
})

// 页面内查找结果事件
ipcRenderer.on('found-in-page-result', (_event, result) => {
  if (callbacks.foundInPage) callbacks.foundInPage(result)
})

// MCP 工具调用请求
ipcRenderer.on('plugin:tool-invoke', async (_event, { name, input, callId }) => {
  const handler = registeredTools.get(name)
  if (!handler) {
    ipcRenderer.send(`plugin:tool-result-${callId}`, {
      success: false,
      error: `工具 "${name}" 未注册`
    })
    return
  }
  try {
    const result = await handler(input ?? {})
    ipcRenderer.send(`plugin:tool-result-${callId}`, { success: true, result })
  } catch (error) {
    ipcRenderer.send(`plugin:tool-result-${callId}`, { success: false, error: error.message })
  }
})

// ── 获取操作系统类型 ──
const osType = ipcRenderer.sendSync('get-os-type')

// ── 使用 contextBridge 暴露 API ──
contextBridge.exposeInMainWorld('ztools', {
  // ========== 基础信息 ==========
  getAppName: () => 'ZTools',
  getPathForFile: (file) => webUtils.getPathForFile(file),
  isMacOs: () => osType === 'Darwin',
  isMacOS: () => osType === 'Darwin',
  isWindows: () => osType === 'Windows_NT',
  isLinux: () => osType === 'Linux',
  getNativeId: () => ipcRenderer.sendSync('get-native-id'),
  getAppVersion: () => ipcRenderer.sendSync('get-app-version'),
  getWindowType: () => ipcRenderer.sendSync('get-window-type'),
  isDarkColors: () => ipcRenderer.sendSync('is-dark-colors'),
  isDev: () => ipcRenderer.sendSync('is-dev'),
  getWebContentsId: () => ipcRenderer.sendSync('get-web-contents-id'),

  // ========== 事件回调 ==========
  onPluginEnter: (callback) => {
    callbacks.enter = callback
  },
  onPluginOut: (callback) => {
    if (callback && typeof callback === 'function') {
      callbacks.pluginOut = callback
    }
  },
  onPluginDetach: (callback) => {
    if (callback && typeof callback === 'function') {
      callbacks.pluginDetach = callback
    }
  },
  onMainPush: (callback, selectCallback) => {
    if (callback && typeof callback === 'function') {
      callbacks.mainPush = { callback, selectCallback }
    }
  },
  onPluginReady: (callback) => {
    callbacks.enter = callback
  },

  // ========== UI 控制 ==========
  showNotification: (body) => ipcRenderer.invoke('show-notification', body),
  showToast: (message, options = {}) =>
    ipcRenderer.invoke('plugin:show-toast', { message, ...options }),
  setExpendHeight: (height) => ipcRenderer.invoke('set-expend-height', height),
  setSubInput: async (onChange, placeholder, isFocus = true) => {
    if (onChange && typeof onChange === 'function') {
      callbacks.subInputChange = onChange
    }
    return await ipcRenderer.invoke('set-sub-input', placeholder, isFocus)
  },
  removeSubInput: async () => {
    callbacks.subInputChange = null
    return await ipcRenderer.invoke('remove-sub-input')
  },
  setSubInputValue: (text) => ipcRenderer.invoke('set-sub-input-value', text),
  subInputFocus: () => ipcRenderer.sendSync('sub-input-focus'),
  subInputBlur: () => ipcRenderer.sendSync('sub-input-blur'),
  subInputSelect: () => ipcRenderer.sendSync('sub-input-select'),

  // ========== 窗口控制 ==========
  showMainWindow: () => ipcRenderer.invoke('show-main-window'),
  hideMainWindow: (isRestorePreWindow = true) =>
    ipcRenderer.invoke('hide-main-window', isRestorePreWindow),
  hideMainWindowPasteText: (text) => ipcRenderer.sendSync('hide-main-window-paste-text', text),
  hideMainWindowPasteImage: (image) => ipcRenderer.sendSync('hide-main-window-paste-image', image),
  hideMainWindowPasteFile: (filePath) =>
    ipcRenderer.sendSync('hide-main-window-paste-file', filePath),
  hideMainWindowTypeString: (text) => ipcRenderer.sendSync('hide-main-window-type-string', text),
  outPlugin: (isKill = false) => ipcRenderer.invoke('out-plugin', isKill),

  // ========== 数据库 API ==========
  db: {
    put: (doc) => ipcRenderer.sendSync('db:put', doc),
    get: (id) => ipcRenderer.sendSync('db:get', id),
    remove: (docOrId) => ipcRenderer.sendSync('db:remove', docOrId),
    bulkDocs: (docs) => ipcRenderer.sendSync('db:bulk-docs', docs),
    allDocs: (key) => ipcRenderer.sendSync('db:all-docs', key),
    postAttachment: (id, attachment, type) =>
      ipcRenderer.sendSync('db:post-attachment', id, attachment, type),
    getAttachment: (id) => ipcRenderer.sendSync('db:get-attachment', id),
    getAttachmentType: (id) => ipcRenderer.sendSync('db:get-attachment-type', id),
    promises: {
      put: (doc) => ipcRenderer.invoke('db:put', doc),
      get: (id) => ipcRenderer.invoke('db:get', id),
      remove: (docOrId) => ipcRenderer.invoke('db:remove', docOrId),
      bulkDocs: (docs) => ipcRenderer.invoke('db:bulk-docs', docs),
      allDocs: (key) => ipcRenderer.invoke('db:all-docs', key),
      postAttachment: (id, attachment, type) =>
        ipcRenderer.invoke('db:post-attachment', id, attachment, type),
      getAttachment: (id) => ipcRenderer.invoke('db:get-attachment', id),
      getAttachmentType: (id) => ipcRenderer.invoke('db:get-attachment-type', id)
    }
  },

  // ========== dbStorage API ==========
  dbStorage: {
    setItem: (key, value) => ipcRenderer.sendSync('db-storage:set-item', key, value),
    getItem: (key) => ipcRenderer.sendSync('db-storage:get-item', key),
    removeItem: (key) => ipcRenderer.sendSync('db-storage:remove-item', key)
  },

  // ========== Feature API ==========
  getFeatures: (codes) => ipcRenderer.sendSync('get-features', codes),
  setFeature: (feature) => ipcRenderer.sendSync('set-feature', feature),
  removeFeature: (code) => ipcRenderer.sendSync('remove-feature', code),

  // ========== 剪贴板 API ==========
  clipboard: {
    getHistory: (page, pageSize, filter) =>
      ipcRenderer.invoke('clipboard:get-history', page, pageSize, filter),
    search: (keyword) => ipcRenderer.invoke('clipboard:search', keyword),
    delete: (id) => ipcRenderer.invoke('clipboard:delete', id),
    clear: (type) => ipcRenderer.invoke('clipboard:clear', type),
    getStatus: () => ipcRenderer.invoke('clipboard:get-status'),
    write: (id, shouldPaste = true) => ipcRenderer.invoke('clipboard:write', id, shouldPaste),
    writeContent: (data, shouldPaste = true) =>
      ipcRenderer.invoke('clipboard:write-content', data, shouldPaste),
    updateConfig: (config) => ipcRenderer.invoke('clipboard:update-config', config),
    onChange: (callback) => {
      callbacks.clipboardChange = callback
    }
  },

  // ========== 剪贴板快捷方法 ==========
  copyText: (text) => ipcRenderer.sendSync('copy-text', text),
  copyImage: (image) => ipcRenderer.sendSync('copy-image', image),
  copyFile: (filePath) => ipcRenderer.sendSync('copy-file', filePath),
  getCopyedFiles: () => ipcRenderer.sendSync('get-copyed-files'),

  // ========== 文件/对话框 API ==========
  getPath: (name) => ipcRenderer.sendSync('get-path', name),
  showSaveDialog: (options) => ipcRenderer.sendSync('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.sendSync('show-open-dialog', options),
  getFileIcon: (filePath) => ipcRenderer.invoke('get-file-icon', filePath),

  // ========== 屏幕截图/取色 ==========
  screenCapture: async (callback) => {
    const { image, bounds } = await ipcRenderer.invoke('screen-capture')
    if (callback && typeof callback === 'function') {
      callback(image, bounds)
    }
  },
  screenColorPick: async (callback) => {
    const result = await ipcRenderer.invoke('screen-color-pick')
    if (result.success && callback && typeof callback === 'function') {
      callback({ hex: result.hex, rgb: result.rgb })
    }
  },

  // ========== Shell API ==========
  shellOpenExternal: (url) => ipcRenderer.sendSync('shell-open-external', url),
  shellOpenPath: (fullPath) => ipcRenderer.sendSync('shell-open-path', fullPath),
  shellShowItemInFolder: (fullPath) => ipcRenderer.sendSync('shell-show-item-in-folder', fullPath),
  shellBeep: () => ipcRenderer.sendSync('shell-beep'),
  shellTrashItem: (fullPath) => ipcRenderer.invoke('shell-trash-item', fullPath),

  // ========== 屏幕显示 API ==========
  getPrimaryDisplay: () => ipcRenderer.sendSync('get-primary-display'),
  getAllDisplays: () => ipcRenderer.sendSync('get-all-displays'),
  getCursorScreenPoint: () => ipcRenderer.sendSync('get-cursor-screen-point'),
  getDisplayNearestPoint: (point) => ipcRenderer.sendSync('get-display-nearest-point', point),
  desktopCaptureSources: (options) => ipcRenderer.invoke('desktop-capture-sources', options),
  dipToScreenPoint: (point) => ipcRenderer.sendSync('dip-to-screen-point', point),
  screenToDipPoint: (point) => ipcRenderer.sendSync('screen-to-dip-point', point),
  dipToScreenRect: (rect) => ipcRenderer.sendSync('dip-to-screen-rect', rect),

  // ========== 输入模拟 ==========
  simulateKeyboardTap: (key, ...modifiers) =>
    ipcRenderer.sendSync('simulate-keyboard-tap', key, modifiers),
  simulateMouseMove: (x, y) => ipcRenderer.sendSync('simulate-mouse-move', x, y),
  simulateMouseClick: (x, y) => ipcRenderer.sendSync('simulate-mouse-click', x, y),
  simulateMouseDoubleClick: (x, y) => ipcRenderer.sendSync('simulate-mouse-double-click', x, y),
  simulateMouseRightClick: (x, y) => ipcRenderer.sendSync('simulate-mouse-right-click', x, y),
  sendInputEvent: (event) => ipcRenderer.invoke('send-input-event', event),

  // ========== 页面查找 ==========
  findInPage: (text, options) => ipcRenderer.invoke('find-in-page', text, options),
  stopFindInPage: (action = 'clearSelection') => ipcRenderer.invoke('stop-find-in-page', action),
  onFindInPageResult: (callback) => {
    if (callback && typeof callback === 'function') {
      callbacks.foundInPage = callback
    }
  },
  offFindInPageResult: (callback) => {
    if (callbacks.foundInPage === callback) {
      callbacks.foundInPage = null
    }
  },

  // ========== 跳转/重定向 ==========
  redirect: (label, payload) => ipcRenderer.sendSync('ztools-redirect', { label, payload }),
  redirectHotKeySetting: (cmdLabel) =>
    ipcRenderer.sendSync('ztools-redirect-hotkey-setting', cmdLabel),
  redirectAiModelsSetting: () => ipcRenderer.sendSync('ztools-redirect-ai-models-setting'),

  // ========== HTTP 请求头设置 ==========
  http: {
    setHeaders: (headers) => ipcRenderer.sendSync('http-set-headers', headers),
    getHeaders: () => ipcRenderer.sendSync('http-get-headers'),
    clearHeaders: () => ipcRenderer.sendSync('http-clear-headers')
  },

  // ========== MCP 工具注册 ==========
  registerTool: (name, handler) => {
    const toolName = typeof name === 'string' ? name.trim() : ''
    if (!toolName) throw new Error('工具名称不能为空')
    if (typeof handler !== 'function') throw new Error(`工具 "${toolName}" 的处理器必须是函数`)

    registeredTools.set(toolName, handler)
    const result = ipcRenderer.sendSync('plugin:tool-register', toolName)
    if (!result?.success) {
      registeredTools.delete(toolName)
      throw new Error(result?.error || `工具 "${toolName}" 注册失败`)
    }
  },

  // ========== AI API ==========
  ai: (option, streamCallback) => {
    const requestId = Math.random().toString(36).substr(2, 9)
    const promiseLike = { abort: () => ipcRenderer.invoke('plugin:ai-abort', requestId) }

    if (streamCallback && typeof streamCallback === 'function') {
      const streamListener = (_event, chunk) => streamCallback(chunk)
      ipcRenderer.on(`plugin:ai-stream-${requestId}`, streamListener)

      const promise = ipcRenderer
        .invoke('plugin:ai-call-stream', requestId, option)
        .then((result) => {
          ipcRenderer.removeListener(`plugin:ai-stream-${requestId}`, streamListener)
          if (!result.success) throw new Error(result.error || 'AI 调用失败')
        })
        .catch((error) => {
          ipcRenderer.removeListener(`plugin:ai-stream-${requestId}`, streamListener)
          throw error
        })

      Object.setPrototypeOf(promiseLike, promise)
      promiseLike.then = promise.then.bind(promise)
      promiseLike.catch = promise.catch.bind(promise)
      promiseLike.finally = promise.finally.bind(promise)
      return promiseLike
    } else {
      const promise = ipcRenderer.invoke('plugin:ai-call', requestId, option).then((result) => {
        if (!result.success) throw new Error(result.error || 'AI 调用失败')
        return result.data
      })

      Object.setPrototypeOf(promiseLike, promise)
      promiseLike.then = promise.then.bind(promise)
      promiseLike.catch = promise.catch.bind(promise)
      promiseLike.finally = promise.finally.bind(promise)
      return promiseLike
    }
  },
  allAiModels: async () => {
    const result = await ipcRenderer.invoke('plugin:ai-all-models')
    if (!result.success) throw new Error(result.error || '获取 AI 模型列表失败')
    return result.data || []
  },

  // ========== 内置插件专用 API ==========
  internal: {
    // 数据库 API
    dbPut: (key, value) => ipcRenderer.invoke('internal:db-put', key, value),
    dbGet: (key) => ipcRenderer.invoke('internal:db-get', key),

    // 应用启动 API
    launch: (params) => ipcRenderer.invoke('internal:launch', params),
    quitApp: () => ipcRenderer.invoke('internal:quit-app'),

    // 指令管理 API
    getCommands: () => ipcRenderer.invoke('internal:get-commands'),

    // 本地启动管理 API
    localShortcuts: {
      getAll: () => ipcRenderer.invoke('local-shortcuts:get-all'),
      add: (type) => ipcRenderer.invoke('local-shortcuts:add', type),
      addByPath: (filePath) => ipcRenderer.invoke('local-shortcuts:add-by-path', filePath),
      delete: (id) => ipcRenderer.invoke('local-shortcuts:delete', id),
      open: (path) => ipcRenderer.invoke('local-shortcuts:open', path),
      updateAlias: (id, alias) => ipcRenderer.invoke('local-shortcuts:update-alias', id, alias)
    },

    // 插件管理 API
    getPlugins: () => ipcRenderer.invoke('internal:get-plugins'),
    getDisabledPlugins: () => ipcRenderer.invoke('internal:get-disabled-plugins'),
    setPluginDisabled: (pluginPath, disabled) =>
      ipcRenderer.invoke('internal:set-plugin-disabled', pluginPath, disabled),
    getAllPlugins: () => ipcRenderer.invoke('internal:get-all-plugins'),
    selectPluginFile: () => ipcRenderer.invoke('internal:select-plugin-file'),
    importPlugin: () => ipcRenderer.invoke('internal:import-plugin'),
    readPluginInfoFromZpx: (zpxPath) =>
      ipcRenderer.invoke('internal:read-plugin-info-from-zpx', zpxPath),
    installPluginFromPath: (zpxPath) =>
      ipcRenderer.invoke('internal:install-plugin-from-path', zpxPath),
    importDevPlugin: (pluginPath) => ipcRenderer.invoke('internal:import-dev-plugin', pluginPath),
    deletePlugin: (pluginPath) => ipcRenderer.invoke('internal:delete-plugin', pluginPath),
    reloadPlugin: (pluginPath) => ipcRenderer.invoke('internal:reload-plugin', pluginPath),
    getRunningPlugins: () => ipcRenderer.invoke('internal:get-running-plugins'),
    killPlugin: (pluginPath) => ipcRenderer.invoke('internal:kill-plugin', pluginPath),
    fetchPluginMarket: () => ipcRenderer.invoke('internal:fetch-plugin-market'),
    installPluginFromMarket: (plugin) =>
      ipcRenderer.invoke('internal:install-plugin-from-market', plugin),
    installPluginFromNpm: (options) =>
      ipcRenderer.invoke('internal:install-plugin-from-npm', options),
    getPluginReadme: (pluginPathOrName, pluginName) =>
      ipcRenderer.invoke('internal:get-plugin-readme', pluginPathOrName, pluginName),
    getPluginDocKeys: (pluginPath) =>
      ipcRenderer.invoke('internal:get-plugin-doc-keys', pluginPath),
    getPluginDoc: (pluginPath, docKey) =>
      ipcRenderer.invoke('internal:get-plugin-doc', pluginPath, docKey),
    getPluginDataStats: () => ipcRenderer.invoke('internal:get-plugin-data-stats'),
    clearPluginData: (pluginName) => ipcRenderer.invoke('internal:clear-plugin-data', pluginName),
    exportPluginData: (pluginName) => ipcRenderer.invoke('internal:export-plugin-data', pluginName),
    exportAllData: () => ipcRenderer.invoke('internal:export-all-data'),
    packagePlugin: (pluginPath) => ipcRenderer.invoke('internal:package-plugin', pluginPath),
    exportAllPlugins: () => ipcRenderer.invoke('internal:export-all-plugins'),
    getPluginMemoryInfo: (pluginPath) =>
      ipcRenderer.invoke('internal:get-plugin-memory-info', pluginPath),

    // 全局快捷键 API
    registerGlobalShortcut: (shortcut, target) =>
      ipcRenderer.invoke('internal:register-global-shortcut', shortcut, target),
    unregisterGlobalShortcut: (shortcut) =>
      ipcRenderer.invoke('internal:unregister-global-shortcut', shortcut),
    startHotkeyRecording: () => ipcRenderer.invoke('internal:start-hotkey-recording'),
    updateShortcut: (shortcut) => ipcRenderer.invoke('internal:update-shortcut', shortcut),
    getCurrentShortcut: () => ipcRenderer.invoke('get-current-shortcut'),
    onHotkeyRecorded: (callback) => {
      if (callback && typeof callback === 'function') {
        callbacks.hotkeyRecorded = callback
      }
    },

    // 应用快捷键 API
    registerAppShortcut: (shortcut, target) =>
      ipcRenderer.invoke('internal:register-app-shortcut', shortcut, target),
    unregisterAppShortcut: (shortcut) =>
      ipcRenderer.invoke('internal:unregister-app-shortcut', shortcut),

    // 系统设置 API
    setWindowOpacity: (opacity) => ipcRenderer.invoke('internal:set-window-opacity', opacity),
    setWindowDefaultHeight: (height) =>
      ipcRenderer.invoke('internal:set-window-default-height', height),
    setWindowMaterial: (material) => ipcRenderer.invoke('internal:set-window-material', material),
    getWindowMaterial: () => ipcRenderer.invoke('internal:get-window-material'),
    selectAvatar: () => ipcRenderer.invoke('internal:select-avatar'),
    setTheme: (theme) => ipcRenderer.invoke('internal:set-theme', theme),
    setTrayIconVisible: (visible) => ipcRenderer.invoke('internal:set-tray-icon-visible', visible),
    setLaunchAtLogin: (enabled) => ipcRenderer.invoke('internal:set-launch-at-login', enabled),
    getLaunchAtLogin: () => ipcRenderer.invoke('internal:get-launch-at-login'),
    setProxyConfig: (config) => ipcRenderer.invoke('internal:set-proxy-config', config),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getSystemVersions: () => ipcRenderer.invoke('get-system-versions'),
    getPlatform: () => ipcRenderer.sendSync('internal:get-platform'),

    // 通知主渲染进程更新配置
    updatePlaceholder: (placeholder) =>
      ipcRenderer.invoke('internal:update-placeholder', placeholder),
    updateAvatar: (avatar) => ipcRenderer.invoke('internal:update-avatar', avatar),
    updateAutoPaste: (autoPaste) => ipcRenderer.invoke('internal:update-auto-paste', autoPaste),
    updateAutoClear: (autoClear) => ipcRenderer.invoke('internal:update-auto-clear', autoClear),
    updateAutoBackToSearch: (autoBackToSearch) =>
      ipcRenderer.invoke('internal:update-auto-back-to-search', autoBackToSearch),
    updateShowRecentInSearch: (showRecentInSearch) =>
      ipcRenderer.invoke('internal:update-show-recent-in-search', showRecentInSearch),
    updateMatchRecommendation: (showMatchRecommendation) =>
      ipcRenderer.invoke('internal:update-match-recommendation', showMatchRecommendation),
    updateRecentRows: (rows) => ipcRenderer.invoke('internal:update-recent-rows', rows),
    updatePinnedRows: (rows) => ipcRenderer.invoke('internal:update-pinned-rows', rows),
    updateSearchMode: (mode) => ipcRenderer.invoke('internal:update-search-mode', mode),
    updateTabKeyFunction: (mode) => ipcRenderer.invoke('internal:update-tab-key-function', mode),
    updateTabTarget: (target) => ipcRenderer.invoke('internal:update-tab-target', target),
    updateSpaceOpenCommand: (enabled) =>
      ipcRenderer.invoke('internal:update-space-open-command', enabled),
    updateFloatingBallDoubleClickCommand: (command) =>
      ipcRenderer.invoke('internal:update-floating-ball-double-click-command', command),
    updateLocalAppSearch: (enabled) =>
      ipcRenderer.invoke('internal:update-local-app-search', enabled),
    updatePrimaryColor: (primaryColor, customColor) =>
      ipcRenderer.invoke('internal:update-primary-color', primaryColor, customColor),
    updateAcrylicOpacity: (lightOpacity, darkOpacity) =>
      ipcRenderer.invoke('internal:update-acrylic-opacity', lightOpacity, darkOpacity),

    onUpdateWindowMaterial: (callback) => {
      callbacks.windowMaterialChange = callback
    },

    // 应用更新 API
    updaterCheckUpdate: () => ipcRenderer.invoke('internal:updater-check-update'),
    updaterStartUpdate: (updateInfo) =>
      ipcRenderer.invoke('internal:updater-start-update', updateInfo),
    updaterSetAutoCheck: (enabled) =>
      ipcRenderer.invoke('internal:updater-set-auto-check', enabled),

    // WebDAV 同步 API
    syncTestConnection: (config) => ipcRenderer.invoke('sync:test-connection', config),
    syncSaveConfig: (config) => ipcRenderer.invoke('sync:save-config', config),
    syncGetConfig: () => ipcRenderer.invoke('sync:get-config'),
    syncPerformSync: () => ipcRenderer.invoke('sync:perform-sync'),
    syncForceDownloadFromCloud: () => ipcRenderer.invoke('sync:force-download-from-cloud'),
    syncStopAutoSync: () => ipcRenderer.invoke('sync:stop-auto-sync'),
    syncGetUnsyncedCount: () => ipcRenderer.invoke('sync:get-unsynced-count'),

    // 其他 API
    revealInFinder: (path) => ipcRenderer.invoke('internal:reveal-in-finder', path),
    notifyDisabledCommandsChanged: () =>
      ipcRenderer.invoke('internal:notify-disabled-commands-changed'),
    pinApp: (app) => ipcRenderer.invoke('internal:pin-app', app),
    unpinApp: (appPath, featureCode, name) =>
      ipcRenderer.invoke('internal:unpin-app', appPath, featureCode, name),

    // 图片分析 API
    analyzeImage: (imagePath) => ipcRenderer.invoke('internal:analyze-image', imagePath),

    // 超级面板 API
    updateSuperPanelConfig: (config) =>
      ipcRenderer.invoke('internal:update-super-panel-config', config),
    updateSuperPanelBlockedApps: (blockedApps) =>
      ipcRenderer.invoke('internal:update-super-panel-blocked-apps', blockedApps),
    getCurrentWindowInfo: () => ipcRenderer.invoke('internal:get-current-window-info'),
    updateSuperPanelTranslate: (enabled) =>
      ipcRenderer.invoke('internal:update-super-panel-translate', enabled),
    getTranslationStatus: () => ipcRenderer.invoke('internal:get-translation-status'),
    pinToSuperPanel: (command) => ipcRenderer.invoke('super-panel:pin-command', command),
    unpinSuperPanelCommand: (path, featureCode) =>
      ipcRenderer.invoke('super-panel:unpin-command', path, featureCode),
    getSuperPanelPinned: () => ipcRenderer.invoke('super-panel:get-pinned'),

    // AI 模型管理 API
    aiModels: {
      getAll: () => ipcRenderer.invoke('internal:ai-models-get-all'),
      add: (model) => ipcRenderer.invoke('internal:ai-models-add', model),
      update: (model) => ipcRenderer.invoke('internal:ai-models-update', model),
      delete: (modelId) => ipcRenderer.invoke('internal:ai-models-delete', modelId)
    },

    // 网页快开 API
    webSearch: {
      getAll: () => ipcRenderer.invoke('internal:web-search-get-all'),
      add: (engine) => ipcRenderer.invoke('internal:web-search-add', engine),
      update: (engine) => ipcRenderer.invoke('internal:web-search-update', engine),
      delete: (engineId) => ipcRenderer.invoke('internal:web-search-delete', engineId),
      fetchFavicon: (url) => ipcRenderer.invoke('internal:web-search-fetch-favicon', url)
    },

    // 悬浮球 API
    setFloatingBallEnabled: (enabled) => ipcRenderer.invoke('floating-ball:set-enabled', enabled),
    getFloatingBallEnabled: () => ipcRenderer.invoke('floating-ball:get-enabled'),
    setFloatingBallLetter: (letter) => ipcRenderer.invoke('floating-ball:set-letter', letter),
    getFloatingBallLetter: () => ipcRenderer.invoke('floating-ball:get-letter'),

    // HTTP 服务 API
    httpServerGetConfig: () => ipcRenderer.invoke('internal:http-server-get-config'),
    httpServerSaveConfig: (config) =>
      ipcRenderer.invoke('internal:http-server-save-config', config),
    httpServerRegenerateKey: () => ipcRenderer.invoke('internal:http-server-regenerate-key'),
    httpServerStatus: () => ipcRenderer.invoke('internal:http-server-status'),

    // MCP 服务 API
    mcpServerGetConfig: () => ipcRenderer.invoke('internal:mcp-server-get-config'),
    mcpServerSaveConfig: (config) => ipcRenderer.invoke('internal:mcp-server-save-config', config),
    mcpServerRegenerateKey: () => ipcRenderer.invoke('internal:mcp-server-regenerate-key'),
    mcpServerStatus: () => ipcRenderer.invoke('internal:mcp-server-status'),
    mcpServerTools: () => ipcRenderer.invoke('internal:mcp-server-tools'),

    // 调试日志 API
    logEnable: () => ipcRenderer.invoke('internal:log-enable'),
    logDisable: () => ipcRenderer.invoke('internal:log-disable'),
    logGetBuffer: () => ipcRenderer.invoke('internal:log-get-buffer'),
    logIsEnabled: () => ipcRenderer.invoke('internal:log-is-enabled'),
    logSubscribe: () => ipcRenderer.invoke('internal:log-subscribe'),
    onLogEntries: (callback) => {
      if (callback && typeof callback === 'function') {
        callbacks.logEntries = callback
      }
    },
    offLogEntries: (callback) => {
      if (callbacks.logEntries === callback) {
        callbacks.logEntries = null
      }
    }
  },

  // ========== Sharp 图像处理（通过 IPC 调用主进程）==========
  sharp: (input, options) => ipcInvoke('sharp:process', { input, options }),

  // ========== zbrowser 浏览器自动化 ==========
  get zbrowser() {
    return createZBrowserProxy()
  },
  get ubrowser() {
    return createZBrowserProxy()
  },
  getIdleUBrowsers: () => ipcSendSync('getIdleZBrowsers'),
  setUBrowserProxy: (config) => ipcInvoke('setZBrowserProxy', config),
  clearUBrowserCache: () => ipcInvoke('clearZBrowserCache'),
  ubrowserLogin: () => ipcInvoke('ubrowserLogin'),

  // ========== FFmpeg（通过 IPC 调用主进程）==========
  runFFmpeg: (args, options) => ipcInvoke('ffmpeg:run', { args, options }),

  // ========== 窗口间通信 ==========
  sendToParent: (channel, ...args) => {
    ipcRenderer.send('send-to-parent', channel, ...args)
  },

  // ========== 文件/路径读取 ==========
  readCurrentFolderPath: () => ipcRenderer.invoke('plugin:read-current-folder-path'),
  readCurrentBrowserUrl: () => ipcRenderer.invoke('plugin:read-current-browser-url'),

  // ========== 创建独立窗口 ==========
  createBrowserWindow: (url, options, callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.on('createBrowserWindow:callback', (_event, result) => {
        callback(result)
      })
    }
    return ipcSendSync('createBrowserWindow', { url, options })
  }
})

// ========== zbrowser 代理对象工厂 ==========
function createZBrowserProxy() {
  const queue = []
  let windowId = null

  const handler = {
    get(target, prop) {
      if (prop === 'run') {
        return async (ubrowserIdOrOptions, options) => {
          if (queue.length === 0) throw new Error('no actions run')
          const actions = [...queue]
          queue.length = 0

          let ubrowserId
          let runOptions = {}
          if (typeof ubrowserIdOrOptions === 'number') {
            ubrowserId = ubrowserIdOrOptions
            if (typeof options === 'object' && options !== null) runOptions = options
          } else if (typeof ubrowserIdOrOptions === 'object' && ubrowserIdOrOptions !== null) {
            runOptions = ubrowserIdOrOptions
          }
          if (ubrowserId === undefined && windowId) {
            ubrowserId = windowId
          }

          const result = await ipcInvoke('runZBrowser', {
            ubrowserId,
            options: runOptions,
            queue: actions
          })
          if (result.error) {
            const err = new Error(result.message)
            err.data = result.data
            throw err
          }
          if (result.windowId) {
            windowId = result.windowId
          }
          const data = result.data || []
          if (result.windowInfo) {
            data.push(result.windowInfo)
          }
          return data
        }
      }
      return (...args) => {
        queue.push({ action: prop, args })
        return new Proxy({}, handler)
      }
    }
  }

  return new Proxy({}, handler)
}

// ========== 列表模式支持 ==========
// 注意：列表模式需要直接操作 DOM，使用安全的 DOM API
ipcRenderer.on('activate-list-mode', (_event, data) => {
  const { featureCode, action, pluginPath } = data
  const feature = window.exports && window.exports[featureCode]
  if (!feature || feature.mode !== 'list') return

  // 列表模式 CSS 样式（内联定义，避免 innerHTML）
  const LIST_CSS = [
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; overflow:hidden;}',
    '.ztools-list { max-height:100vh; overflow-y:auto; overflow-x:hidden; padding:0 0 2px 0; }',
    '.ztools-li { display:flex; align-items:center; gap:12px; padding:8px 12px; border-radius:6px; cursor:pointer; transition:background-color .15s; user-select:none; }',
    '.ztools-li:hover { background:rgba(0,0,0,.05); }',
    '.ztools-li.selected { background:rgba(0,0,0,.05); }',
    '.ztools-list.ignore-mouse-hover .ztools-li:hover { background:transparent; }',
    '.ztools-li-icon { flex-shrink:0; width:32px; height:32px; display:flex; align-items:center; justify-content:center; }',
    '.ztools-li-icon img { width:100%; height:100%; object-fit:contain; }',
    '.ztools-li-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }',
    '.ztools-li-title { font-size:14px; font-weight:500; color:#1a1a1a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '.ztools-li-desc { font-size:12px; color:#666; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '@media(prefers-color-scheme:dark){',
    '  .ztools-li:hover { background:rgba(255,255,255,.08); }',
    '  .ztools-li.selected { background:rgba(255,255,255,.08); }',
    '  .ztools-list.ignore-mouse-hover .ztools-li:hover { background:transparent; }',
    '  .ztools-li-title { color:#e5e5e5; }',
    '  .ztools-li-desc { color:#999; }',
    '}'
  ].join('\n')

  // 安全地清空并重建 DOM（避免 innerHTML）
  while (document.head.firstChild) {
    document.head.removeChild(document.head.firstChild)
  }
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild)
  }
  document.body.style.cssText = 'margin:0;padding:0;overflow:hidden;'

  const style = document.createElement('style')
  style.textContent = LIST_CSS
  document.head.appendChild(style)

  const container = document.createElement('div')
  container.className = 'ztools-list'
  document.body.appendChild(container)

  // 列表状态
  const listState = {
    items: [],
    selectedIndex: 0,
    container,
    ignoreMouseHover: false,
    _action: action,
    _pluginPath: pluginPath,
    _selectFn:
      feature.args && typeof feature.args.select === 'function' ? feature.args.select : null
  }

  // 渲染列表项
  function renderItems(items) {
    listState.items = items || []
    listState.selectedIndex = 0
    // 安全清空容器
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    items.forEach((item, i) => {
      const div = document.createElement('div')
      div.className = 'ztools-li' + (i === 0 ? ' selected' : '')
      div.dataset.index = i

      const iconDiv = document.createElement('div')
      iconDiv.className = 'ztools-li-icon'
      if (item.icon) {
        const img = document.createElement('img')
        let iconSrc = item.icon
        if (
          !iconSrc.startsWith('http') &&
          !iconSrc.startsWith('file:') &&
          !iconSrc.startsWith('') &&
          pluginPath
        ) {
          iconSrc = 'file://' + pluginPath.replace(/\\/g, '/') + '/' + iconSrc
        }
        img.src = iconSrc
        img.draggable = false
        img.onerror = function () {
          this.style.display = 'none'
        }
        iconDiv.appendChild(img)
      }
      div.appendChild(iconDiv)

      const bodyDiv = document.createElement('div')
      bodyDiv.className = 'ztools-li-body'
      const titleDiv = document.createElement('div')
      titleDiv.className = 'ztools-li-title'
      titleDiv.textContent = item.title || ''
      bodyDiv.appendChild(titleDiv)
      if (item.description) {
        const descDiv = document.createElement('div')
        descDiv.className = 'ztools-li-desc'
        descDiv.textContent = item.description
        bodyDiv.appendChild(descDiv)
      }
      div.appendChild(bodyDiv)

      div.addEventListener('mousemove', () => {
        if (listState.ignoreMouseHover) {
          listState.ignoreMouseHover = false
        }
        if (listState.selectedIndex === i) return
        listState.selectedIndex = i
        updateSelection()
      })

      div.addEventListener('click', () => {
        listState.selectedIndex = i
        updateSelection()
        doSelect()
      })

      container.appendChild(div)
    })

    updateHeight()
  }

  function updateSelection() {
    const nodes = container.querySelectorAll('.ztools-li')
    nodes.forEach((node, i) => {
      node.classList.toggle('selected', i === listState.selectedIndex)
    })
    const sel = container.querySelector('.ztools-li.selected')
    if (sel) sel.scrollIntoView({ block: 'nearest' })
  }

  function updateHeight() {
    if (!container || container.children.length === 0) {
      window.ztools.setExpendHeight(0)
      return
    }
    const height = Math.min(container.scrollHeight, 541)
    window.ztools.setExpendHeight(height)
  }

  function doSelect() {
    const item = listState.items[listState.selectedIndex]
    if (!item || !listState._selectFn) return
    listState._selectFn(listState._action, item, renderItems)
  }

  // 键盘事件
  document.addEventListener('keydown', (e) => {
    const maxIdx = listState.items.length - 1
    if (maxIdx < 0) return

    if (e.key === 'ArrowUp' || e.key === 'Up') {
      e.preventDefault()
      listState.ignoreMouseHover = true
      listState.selectedIndex = listState.selectedIndex > 0 ? listState.selectedIndex - 1 : maxIdx
      updateSelection()
    } else if (e.key === 'ArrowDown' || e.key === 'Down') {
      e.preventDefault()
      listState.ignoreMouseHover = true
      listState.selectedIndex = listState.selectedIndex < maxIdx ? listState.selectedIndex + 1 : 0
      updateSelection()
    } else if (e.key === 'Enter' || e.key === 'Return') {
      e.preventDefault()
      doSelect()
    }
  })

  // 设置子输入框
  if (feature.args && typeof feature.args.search === 'function') {
    window.ztools.setSubInput(
      (details) => feature.args.search(action, details.text, renderItems),
      feature.args.placeholder || '搜索',
      true
    )
  }

  // 调用 enter
  if (feature.args && typeof feature.args.enter === 'function') {
    feature.args.enter(action, renderItems)
  }
})

// ESC 键处理
window.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape') {
      ipcRenderer.send('plugin-esc-pressed')
    }
  },
  false
)

// 无界面插件方法调用
ipcRenderer.on('call-plugin-method', async (_event, { featureCode, action, callId }) => {
  try {
    if (!window.exports) {
      ipcRenderer.send(`plugin-method-result-${callId}`, {
        success: false,
        error: 'window.exports is not defined'
      })
      return
    }

    const feature = window.exports[featureCode]
    if (!feature) {
      ipcRenderer.send(`plugin-method-result-${callId}`, {
        success: false,
        error: `Feature "${featureCode}" not found`
      })
      return
    }

    if (feature.mode !== 'none') {
      ipcRenderer.send(`plugin-method-result-${callId}`, {
        success: false,
        error: `Mode "${feature.mode}" is not supported`
      })
      return
    }

    if (!feature.args || typeof feature.args.enter !== 'function') {
      ipcRenderer.send(`plugin-method-result-${callId}`, {
        success: false,
        error: 'Feature does not have a valid enter function'
      })
      return
    }

    const result = await feature.args.enter(action)
    ipcRenderer.send(`plugin-method-result-${callId}`, { success: true, result })
  } catch (error) {
    ipcRenderer.send(`plugin-method-result-${callId}`, {
      success: false,
      error: error.message || String(error)
    })
  }
})

// 获取插件模式
ipcRenderer.on('get-plugin-mode', (_event, { featureCode, callId }) => {
  const mode =
    window.exports && window.exports[featureCode] ? window.exports[featureCode].mode : undefined
  ipcRenderer.send(`plugin-mode-result-${callId}`, mode)
})
