import type { CDPSession } from 'playwright'

type Packet = { id?: number; method?: string; params?: unknown; result?: unknown; error?: unknown }
type Listener = (params: unknown) => void
export interface NativeSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
  on(event: string, listener: Listener): unknown
  off(event: string, listener: Listener): unknown
}

/** Public CDP Target messages keep embedded renderers under the same request
 * policy. No Playwright internals or collected website data are used as commands. */
export function childNativeSession(parent: NativeSession, sessionId: string) {
  let nextId = 0, closed = false
  const pending = new Map<number, { method: string; resolve: (result: unknown) => void; reject: (error: Error) => void }>()
  const listeners = new Map<string, Set<Listener>>()
  const receive = (event: unknown) => {
    const incoming = event as { sessionId: string; message: string }
    if (incoming.sessionId !== sessionId) return
    const packet = JSON.parse(incoming.message) as Packet
    if (packet.id !== undefined) {
      const command = pending.get(packet.id); pending.delete(packet.id)
      if (packet.error) command?.reject(new Error('Native request boundary command failed: ' + command.method))
      else command?.resolve(packet.result)
    } else if (packet.method) for (const listener of listeners.get(packet.method) ?? []) listener(packet.params)
  }
  const dispose = () => {
    if (closed) return
    closed = true
    parent.off('Target.receivedMessageFromTarget', receive); parent.off('Target.detachedFromTarget', detached); parent.off('NativeSession.closed', dispose)
    for (const listener of [...listeners.get('NativeSession.closed') ?? []]) listener(undefined)
    for (const command of pending.values()) command.reject(new Error('Native request target closed'))
    pending.clear(); listeners.clear()
  }
  const detached = (event: unknown) => { if ((event as { sessionId: string }).sessionId === sessionId) dispose() }
  parent.on('Target.receivedMessageFromTarget', receive); parent.on('Target.detachedFromTarget', detached); parent.on('NativeSession.closed', dispose)
  const channel: NativeSession = {
    send(method, params) {
      if (closed) return Promise.reject(new Error('Native request target closed'))
      const id = ++nextId
      return new Promise((resolve, reject) => {
        pending.set(id, { method, resolve, reject })
        void parent.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(() => {
          pending.delete(id); reject(new Error('Native request boundary command failed'))
        })
      })
    },
    on(event, listener) { const handlers = listeners.get(event) ?? new Set<Listener>(); handlers.add(listener); listeners.set(event, handlers) },
    off(event, listener) { listeners.get(event)?.delete(listener) },
  }
  return { channel, dispose, isClosed: () => closed }
}

export const nativeSession = (session: CDPSession): NativeSession => session
