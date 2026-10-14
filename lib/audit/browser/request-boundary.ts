import type { Page, Route } from 'playwright'
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
  // CDP emits outside the worker's async context. Keep its admitted execution
  // ownership so request-time transactions retain the normal lease fences.
  const admittedPolicy = policy ? AsyncResource.bind(policy) : undefined
  let disposed = false
  const cleanups = new Set<() => void>()
  const handle = async (event: PausedRequest, channel: NativeSession, child: boolean) => {
    const requestHeaders = new URL(event.request.url).origin === origin && Object.keys(configured).length
      ? { ...Object.fromEntries(Object.entries(event.request.headers).map(([name, value]) => [name.toLowerCase(), value])), ...configured } : undefined
    const resume = async () => { await channel.send('Fetch.continueRequest', { requestId: event.requestId,
      ...(requestHeaders ? { headers: Object.entries(requestHeaders).map(([name, value]) => ({ name, value })) } : {}) }) }
    const abort = async () => { await channel.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }) }
    // Execute caller authority exactly once for each physical hop. Playwright
    // routes can skip redirects or overlap native interception in child frames.
    if (admittedPolicy && !await admittedPolicy({ url: event.request.url, method: event.request.method,
      navigation: event.resourceType === 'Document', postData: event.request.postData ?? null, resourceType: event.resourceType.toLowerCase() })) {
      await abort(); return
    }
    if (event.redirectedRequestId || child) {
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
  const initialize = async (channel: NativeSession, child = false, closed = () => disposed, interceptsNetwork = true) => {
    const listener = (data: unknown) => {
      const event = data as PausedRequest
      void handle(event, channel, child).catch(async () => {
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
      void initialize(embedded.channel, true, embedded.isClosed, target.targetInfo.type === 'iframe' || target.targetInfo.type === 'page')
        .then(() => embedded.channel.send('Runtime.runIfWaitingForDebugger')).catch(async () => {
        if (!disposed && !embedded.isClosed()) await page.context().close().catch(() => undefined)
      })
    }
    channel.on('Fetch.requestPaused', listener); channel.on('Target.attachedToTarget', attached)
    cleanups.add(() => { channel.off('Fetch.requestPaused', listener); channel.off('Target.attachedToTarget', attached) })
    // Chromium sends worker network interception through its owning renderer.
    if (interceptsNetwork) await channel.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
    await channel.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: false })
  }
  const dispose = () => { disposed = true; for (const cleanup of cleanups) cleanup(); cleanups.clear() }
  page.once('close', dispose)
  try { await initialize(nativeSession(connection)) }
  catch (error) { dispose(); await connection.detach().catch(() => undefined); throw error }
}
