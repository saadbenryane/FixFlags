import type { Page, Route, Request } from 'playwright'
import { AsyncResource } from 'node:async_hooks'
import { childNativeSession, nativeSession, type NativeSession } from './native-session'

type PausedRequest = { requestId: string; redirectedRequestId?: string; resourceType: string; frameId: string;
  request: { url: string; method: string; headers: Record<string, string>; postData?: string } }
export type BrowserRequest = { url: string; method: string; navigation: boolean; postData: string | null; resourceType: string }
export type BrowserRequestPolicy = (request: BrowserRequest) => Promise<boolean>

/** Playwright skips user routes on HTTP redirects and replays route header
 * overrides. Native interception scopes headers per hop and gives redirects
 * the same admission policy without replaying their physical requests. */
export async function installRequestBoundary(page: Page, targetUrl: string,
  headers: Record<string, string> | undefined, guard: (route: Route) => Promise<void>, policy?: BrowserRequestPolicy) {
  const connection = await page.context().newCDPSession(page)
  const mainFrameId = (await connection.send('Page.getFrameTree')).frameTree.frame.id as string
  const origin = new URL(targetUrl).origin
  const configured = Object.fromEntries(Object.entries(headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]))
  const scopedHeaders = (url: string, values: Record<string, string>) => {
    if (!Object.keys(configured).length) return undefined
    const approved = new URL(url).origin === origin
    const retained = Object.fromEntries(Object.entries(values).map(([name, value]) => [name.toLowerCase(), value])
      .filter(([name]) => approved || !Object.hasOwn(configured, name)))
    return approved ? { ...retained, ...configured } : retained
  }
  // CDP emits outside the worker's async context. Keep its admitted execution
  // ownership so request-time transactions retain the normal lease fences.
  const admittedPolicy = policy ? AsyncResource.bind(policy) : undefined
  let disposed = false
  const cleanups = new Set<() => void>()
  const handle = async (event: PausedRequest, channel: NativeSession) => {
    const requestHeaders = scopedHeaders(event.request.url, event.request.headers)
    const resume = async () => { await channel.send('Fetch.continueRequest', { requestId: event.requestId,
      ...(requestHeaders ? { headers: Object.entries(requestHeaders).map(([name, value]) => ({ name, value })) } : {}) }) }
    const abort = async () => { await channel.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }) }
    // Shared routing owns first requests. Native interception owns redirects,
    // which Playwright can omit, without consuming either policy twice.
    if (event.redirectedRequestId && admittedPolicy && !await admittedPolicy({ url: event.request.url, method: event.request.method,
      navigation: event.resourceType === 'Document', postData: event.request.postData ?? null, resourceType: event.resourceType.toLowerCase() })) {
      await abort(); return
    }
    if (event.redirectedRequestId) {
      // Only the request fields used by the shared admission policy are exposed.
      // A redirected POST still needs that policy's explicit mutation authority.
      const route = { request: () => ({ url: () => event.request.url, method: () => event.request.method,
        isNavigationRequest: () => event.resourceType === 'Document', postData: () => event.request.postData ?? null,
        resourceType: () => event.resourceType.toLowerCase(), frame: () => {
          if (event.frameId === mainFrameId) return page.mainFrame()
          throw new Error('Redirected request is outside the top-document observation scope')
        } }), fallback: resume, abort }
      await guard(route as unknown as Route)
    } else await resume()
  }
  const initialize = async (channel: NativeSession, closed = () => disposed, interceptsNetwork = true) => {
    const listener = (data: unknown) => {
      const event = data as PausedRequest
      void handle(event, channel).catch(async () => {
        if (closed() || disposed) return
        // A failed interception cannot release an unchecked request.
        try { await channel.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }) }
        catch { await page.context().close().catch(() => undefined) }
      })
    }
    const attached = (data: unknown) => {
      const target = data as { sessionId: string; targetInfo: { type: string } }
      const embedded = childNativeSession(channel, target.sessionId)
      cleanups.add(embedded.dispose)
      void initialize(embedded.channel, embedded.isClosed, target.targetInfo.type === 'iframe')
        .then(() => embedded.channel.send('Runtime.runIfWaitingForDebugger')).catch(async () => {
        if (!disposed && !embedded.isClosed()) await page.context().close().catch(() => undefined)
      })
    }
    channel.on('Fetch.requestPaused', listener); channel.on('Target.attachedToTarget', attached)
    cleanups.add(() => { channel.off('Fetch.requestPaused', listener); channel.off('Target.attachedToTarget', attached) })
    // Chromium sends worker network interception through its owning renderer.
    if (interceptsNetwork) await channel.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
    await channel.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: false,
      filter: [{ type: 'page', exclude: true }, { type: 'browser', exclude: true }, { type: 'tab', exclude: true }, {}] })
  }
  const dispose = () => { disposed = true; for (const cleanup of cleanups) cleanup(); cleanups.clear() }
  page.context().once('close', dispose)
  try {
    // Popups sit outside the original renderer's child attachment tree. First
    // requests wait for their native redirect boundary. Policy belongs only to
    // this isolated context; other audits retain their own authority.
    const browser = page.context().browser()
    if (!browser) throw new Error('Native browser authority is unavailable')
    const browserConnection = await browser.newBrowserCDPSession()
    cleanups.add(() => { void browserConnection.detach().catch(() => undefined) })
    const { targetInfo: owner } = await connection.send('Target.getTargetInfo')
    if (!owner.browserContextId) throw new Error('Native browser context authority is unavailable')
    const attachedTargets = new Set<string>([owner.targetId])
    const pendingAuxiliary = new Set<Promise<void>>()
    const attached = (data: unknown) => {
      const target = data as { sessionId: string; targetInfo: { targetId: string; browserContextId?: string } }
      if (target.targetInfo.browserContextId !== owner.browserContextId) {
        void browserConnection.send('Target.detachFromTarget', { sessionId: target.sessionId }).catch(() => undefined)
        return
      }
      if (attachedTargets.has(target.targetInfo.targetId)) return
      attachedTargets.add(target.targetInfo.targetId)
      const initialization = (async () => {
        // Browser auto-attachment requires the flat protocol. A separate native
        // session supplies the existing nested transport through public CDP APIs.
        // First-hop routing holds requests until this setup completes.
        const manual = await browserConnection.send('Target.attachToTarget', { targetId: target.targetInfo.targetId, flatten: false })
        const auxiliary = childNativeSession(nativeSession(browserConnection), manual.sessionId)
        cleanups.add(auxiliary.dispose)
        await initialize(auxiliary.channel, auxiliary.isClosed)
        void browserConnection.send('Target.detachFromTarget', { sessionId: target.sessionId }).catch(() => undefined)
      })()
      pendingAuxiliary.add(initialization)
      void initialization.then(() => pendingAuxiliary.delete(initialization), async () => {
        pendingAuxiliary.delete(initialization)
        if (!disposed) await page.context().close().catch(() => undefined)
      })
    }
    browserConnection.on('Target.attachedToTarget', attached)
    cleanups.add(() => browserConnection.off('Target.attachedToTarget', attached))
    await browserConnection.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true,
      filter: [{ type: 'page' }, { exclude: true }] })
    const guardedRequests = new WeakSet<Request>()
    const firstHop = async (route: Route) => {
      const request = route.request()
      if (guardedRequests.has(request) || request.redirectedFrom()) return route.fallback()
      guardedRequests.add(request)
      try {
        let primary = false
        try { primary = request.frame().page() === page } catch { /* Worker and initial popup requests still belong to this context. */ }
        if (!primary) {
          // Flush target announcements on the same CDP connection before reading
          // the pending set, including a popup's browser-owned first POST.
          await browserConnection.send('Target.getTargets')
          await Promise.all([...pendingAuxiliary])
        }
        if (admittedPolicy && !await admittedPolicy({ url: request.url(), method: request.method(), navigation: request.isNavigationRequest(),
          postData: request.postData(), resourceType: request.resourceType() })) return await route.abort('blockedbyclient')
        await guard(route)
      } catch { await route.abort('blockedbyclient').catch(() => undefined) }
    }
    await page.context().route('**', firstHop)
    // Keep the owner guard ahead of configured page routes. The same Request
    // can fall through both entrypoints but receives one policy decision.
    await page.route('**', firstHop)
    await initialize(nativeSession(connection))
  }
  catch (error) { dispose(); await connection.detach().catch(() => undefined); throw error }
}
