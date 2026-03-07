import type { BrowserWindow, WebContentsView } from 'electron'

export type AssemblyStatus =
  | 'idle'
  | 'assembling'
  | 'domReady'
  | 'readyToDisplay'
  | 'displayed'
  | 'aborted'

export interface AssemblySession {
  id: string
  pluginPath: string
  featureCode: string
  status: AssemblyStatus
  createdAt: number
}

export interface EnterPayload {
  code: string
  type: string
  payload: any
  option?: any
}

export interface EnterPayloadWithAssembly extends EnterPayload {
  __assemblyId?: string
  __ts: number
}

export type LifecycleEventName = 'PluginReady' | 'PluginEnter' | 'PluginOut' | 'PluginDetach'

export class PluginAssemblyCoordinator {
  private currentSession: AssemblySession | null = null
  private lifecycleChains = new Map<number, Promise<void>>()
  private domReadyViews = new Set<number>()

  public trace(
    stage: string,
    info: { assemblyId?: string; pluginPath?: string; featureCode?: string; [key: string]: any }
  ): void {
    console.log('[Plugin][Assembly][Trace]', {
      stage,
      ...info
    })
  }

  private newAssemblyId(): string {
    return `asm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }

  public beginAssembly(pluginPath: string, featureCode: string): AssemblySession {
    const old = this.currentSession
    if (old) {
      old.status = 'aborted'
      this.trace('abort-previous', {
        assemblyId: old.id,
        pluginPath: old.pluginPath,
        featureCode: old.featureCode,
        previousStatus: old.status
      })
    }

    const session: AssemblySession = {
      id: this.newAssemblyId(),
      pluginPath,
      featureCode,
      status: 'assembling',
      createdAt: Date.now()
    }
    this.currentSession = session

    this.trace('begin', {
      assemblyId: session.id,
      pluginPath,
      featureCode,
      createdAt: session.createdAt
    })

    return session
  }

  public hasCurrentSession(): boolean {
    return !!this.currentSession
  }

  public getCurrentSession(): AssemblySession | null {
    return this.currentSession
  }

  public isActiveSession(session: AssemblySession): boolean {
    return (
      !!this.currentSession &&
      this.currentSession.id === session.id &&
      this.currentSession.status !== 'aborted'
    )
  }

  public markSessionStatus(session: AssemblySession, status: AssemblyStatus): void {
    if (!this.isActiveSession(session)) return
    const previousStatus = this.currentSession!.status
    this.currentSession!.status = status
    this.trace('status-change', {
      assemblyId: session.id,
      pluginPath: session.pluginPath,
      featureCode: session.featureCode,
      from: previousStatus,
      to: status
    })
  }

  public abortCurrentSession(stage: string = 'abort-current-session'): void {
    if (!this.currentSession) return
    this.currentSession.status = 'aborted'
    this.trace(stage, {
      assemblyId: this.currentSession.id,
      pluginPath: this.currentSession.pluginPath,
      featureCode: this.currentSession.featureCode
    })
  }

  public clearCurrentSession(): void {
    this.currentSession = null
  }

  public getSessionToken(session: AssemblySession): string {
    return `${session.pluginPath}::${session.featureCode}::${session.id}`
  }

  public buildEnterPayload(
    action: EnterPayload,
    session?: AssemblySession
  ): EnterPayloadWithAssembly {
    const payload: EnterPayloadWithAssembly = {
      ...action,
      __assemblyId: session?.id,
      __ts: Date.now()
    }
    this.trace('build-enter-payload', {
      assemblyId: session?.id,
      enterTs: payload.__ts
    })
    return payload
  }

  public async requestRendererAck(
    mainWindow: BrowserWindow | null,
    session: AssemblySession
  ): Promise<boolean> {
    if (!mainWindow || mainWindow.webContents.isDestroyed()) {
      this.trace('ack-skip-main-window-unavailable', {
        assemblyId: session.id,
        pluginPath: session.pluginPath,
        featureCode: session.featureCode
      })
      return false
    }

    const token = this.getSessionToken(session)
    const startAt = Date.now()
    this.trace('ack-request-start', {
      assemblyId: session.id,
      pluginPath: session.pluginPath,
      featureCode: session.featureCode,
      token
    })

    try {
      await mainWindow.webContents.executeJavaScript(
        `window.ztools?.setAssemblyTarget?.(${JSON.stringify(token)})`
      )
      const returned = await mainWindow.webContents.executeJavaScript(
        `window.ztools?.endAssemblyPlugin?.()`
      )
      const ok = returned === token
      this.trace('ack-request-finish', {
        assemblyId: session.id,
        pluginPath: session.pluginPath,
        featureCode: session.featureCode,
        token,
        returned,
        ok,
        durationMs: Date.now() - startAt
      })

      if (!ok) {
        console.warn('[Plugin][Assembly] ack mismatch:', {
          assemblyId: session.id,
          expected: token,
          returned
        })
      }
      return ok
    } catch (error) {
      console.error('[Plugin][Assembly] request ack failed:', error)
      return false
    }
  }

  public async dispatchLifecycleEvent(
    view: WebContentsView,
    eventName: LifecycleEventName,
    payload?: any
  ): Promise<void> {
    const webContents = view?.webContents
    if (!webContents || webContents.isDestroyed()) {
      console.warn('[Plugin][Lifecycle] skip: view unavailable or destroyed', { eventName })
      return
    }

    const id = webContents.id
    const prev = this.lifecycleChains.get(id) ?? Promise.resolve()
    const hasQueued = this.lifecycleChains.has(id)
    console.log('[Plugin][Lifecycle] queue-enter', {
      webContentsId: id,
      eventName,
      hasQueued
    })
    const next = prev
      .catch(() => {})
      .then(() => {
        if (webContents.isDestroyed()) return
        console.log('[Plugin][Lifecycle] dispatch', { webContentsId: id, eventName })

        if (eventName === 'PluginEnter') {
          webContents.send('on-plugin-enter', payload)
          return
        }
        if (eventName === 'PluginOut') {
          webContents.send('plugin-out', !!payload)
          return
        }
        if (eventName === 'PluginDetach') {
          webContents.send('plugin-detach')
          return
        }
        webContents.send('plugin-ready', payload)
      })
    this.lifecycleChains.set(id, next)

    try {
      await next
      console.log('[Plugin][Lifecycle] queue-finish', { webContentsId: id, eventName })
    } finally {
      if (this.lifecycleChains.get(id) === next) {
        this.lifecycleChains.delete(id)
        console.log('[Plugin][Lifecycle] queue-clear', { webContentsId: id, eventName })
      }
    }
  }

  public markDomReady(webContentsId: number): void {
    this.domReadyViews.add(webContentsId)
  }

  public clearDomReady(webContentsId: number): void {
    this.domReadyViews.delete(webContentsId)
  }

  public async waitForDomReady(view: WebContentsView, timeoutMs: number = 5000): Promise<void> {
    const webContents = view.webContents
    if (webContents.isDestroyed()) {
      console.warn('[Plugin][DomReady] skip: webContents destroyed')
      return
    }
    if (this.domReadyViews.has(webContents.id)) {
      console.log('[Plugin][DomReady] hit cached ready state', {
        webContentsId: webContents.id
      })
      return
    }

    console.log('[Plugin][DomReady] waiting', {
      webContentsId: webContents.id,
      timeoutMs
    })

    await new Promise<void>((resolve) => {
      let done = false
      const startedAt = Date.now()
      const finish = (): void => {
        if (done) return
        done = true
        clearTimeout(timeout)
        console.log('[Plugin][DomReady] finished', {
          webContentsId: webContents.id,
          durationMs: Date.now() - startedAt
        })
        resolve()
      }

      const timeout = setTimeout(() => {
        console.warn('[Plugin][DomReady] timeout fallback triggered', {
          webContentsId: webContents.id,
          timeoutMs
        })
        finish()
      }, timeoutMs)

      webContents.once('dom-ready', () => {
        this.markDomReady(webContents.id)
        console.log('[Plugin][DomReady] event received', { webContentsId: webContents.id })
        finish()
      })
    })
  }
}
