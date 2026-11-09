import { classifyTrackingEndpoint } from '../tracking/endpoints'
import { libraryResponseWithoutFullBody, type TrackingRequest } from '../tracking/contracts'
import { trackingRedirectKey } from '../tracking/identity'
import { isJavaScriptMimeType } from '../javascript-mime'
import { isBotInterstitialPage } from './page-capture'
import type { NativeSession } from './native-session'

type Library = NonNullable<ReturnType<typeof classifyTrackingEndpoint>>
type LibraryRecord = TrackingRequest & { requestKey: string }
type RequestEvent = {
  requestId: string; frameId?: string; type?: string; documentURL: string;
  request: { url: string; method: string }; redirectResponse?: { status: number }
}
type ResponseEvent = {
  requestId: string; response: { status: number; headers: Record<string, string>;
    fromDiskCache?: boolean; fromServiceWorker?: boolean; fromPrefetchCache?: boolean }
}
type Transfer = { record: LibraryRecord; data: boolean; cached: boolean; stopped: boolean }

/** Only the top document's recognized scripts enter the bounded request
 * inventory. Chromium owns the ID from the first hop to the final decoded byte. */
export async function observeNativeLibraries(channel: NativeSession, mainFrameId: string, pageOrigin: string,
  register: (endpoint: Library, url: string, method: string, documentUrl?: string) => LibraryRecord | undefined,
  changed: () => void) {
  const active = new Map<string, Transfer>()
  const request = (value: unknown) => {
    const event = value as RequestEvent
    const prior = active.get(event.requestId)
    if (event.frameId !== mainFrameId || prior?.stopped || (!prior && event.type !== 'Script')) return
    const { url } = event.request
    const method = event.request.method.toUpperCase()
    const endpoint = classifyTrackingEndpoint(url, 'script', event.documentURL) ??
      classifyTrackingEndpoint(url, 'script', pageOrigin)
    if (prior && event.redirectResponse) {
      const record = prior.record
      if (endpoint?.role === 'event') {
        // The request guard owns event suppression. This hop cannot supply
        // library bytes even if Chromium sends a terminal response for it.
        record.status = event.redirectResponse.status
        prior.stopped = true
        return
      }
      record.state = 'pending'; record.status = null; record.reason = null
      delete record.responseKind
      record.requestKey = trackingRedirectKey(record.requestKey, url, method)
      if (endpoint) {
        Object.assign(record, endpoint, { method: recordedTrackingMethod(method) })
        delete record.redirected
      } else record.redirected = true
      prior.data = false; prior.cached = false
      return
    }
    if (endpoint?.role !== 'library') return
    const record = register(endpoint, url, method, event.redirectResponse ? undefined : event.documentURL)
    if (record) active.set(event.requestId, { record, data: false, cached: false, stopped: false })
  }
  const response = (value: unknown) => {
    const event = value as ResponseEvent
    const transfer = active.get(event.requestId)
    if (!transfer || transfer.stopped) return
    const { record } = transfer
    const { status, headers, fromDiskCache, fromServiceWorker, fromPrefetchCache } = event.response
    const fields = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
    const mediaType = fields['content-type']?.split(';', 1)[0].trim().toLowerCase()
    const nosniff = fields['x-content-type-options']?.split(',', 1)[0].trim().toLowerCase() === 'nosniff'
    transfer.cached ||= Boolean(fromDiskCache || fromServiceWorker || fromPrefetchCache)
    record.status = status
    record.state = 'response'
    if (isBotInterstitialPage({ cfMitigated: fields['cf-mitigated'] })) record.responseKind = 'challenge'
    else if (status >= 200 && status < 300) {
      if (mediaType === 'text/html' || mediaType === 'application/xhtml+xml') record.responseKind = 'html'
      else if (nosniff && !isJavaScriptMimeType(mediaType)) record.responseKind = 'script_mime'
    }
    changed()
  }
  const data = (value: unknown) => {
    const { requestId, dataLength } = value as { requestId: string; dataLength: number }
    const transfer = active.get(requestId)
    if (transfer && dataLength > 0) transfer.data = true
  }
  const cache = (value: unknown) => {
    const transfer = active.get((value as { requestId: string }).requestId)
    if (transfer) transfer.cached = true
  }
  const finished = (value: unknown) => {
    const { requestId } = value as { requestId: string }
    const transfer = active.get(requestId)
    if (!transfer) return
    active.delete(requestId)
    const { record } = transfer
    record.state = 'completed'
    if (!transfer.stopped && !transfer.cached && !record.responseKind && record.status !== null &&
      record.status >= 200 && record.status < 300 && !libraryResponseWithoutFullBody(record)) {
      if (transfer.data) record.libraryResponseQualified = true
      else record.responseKind = 'empty'
    }
    changed()
  }
  const failed = (value: unknown) => {
    const { requestId, errorText } = value as { requestId: string; errorText: string }
    const transfer = active.get(requestId)
    if (!transfer) return
    active.delete(requestId)
    transfer.record.state = 'failed'
    transfer.record.reason = /ERR_BLOCKED_BY_CLIENT|ERR_FAILED/i.test(errorText) ? 'browser_blocked' : 'transport_failed'
    changed()
  }
  const listeners = {
    'Network.requestWillBeSent': request, 'Network.responseReceived': response, 'Network.dataReceived': data,
    'Network.requestServedFromCache': cache, 'Network.loadingFinished': finished, 'Network.loadingFailed': failed,
  }
  const dispose = () => {
    for (const [event, listener] of Object.entries(listeners)) channel.off(event, listener)
    active.clear()
  }
  for (const [event, listener] of Object.entries(listeners)) channel.on(event, listener)
  try {
    // Decoded lengths are metadata. No response body or request payload is copied.
    await channel.send('Network.enable', { maxTotalBufferSize: 0, maxResourceBufferSize: 0, maxPostDataSize: 0 })
  } catch (error) { dispose(); throw error }
  return () => {
    dispose()
    void channel.send('Network.disable').catch(() => undefined)
  }
}

export function recordedTrackingMethod(method: string): TrackingRequest['method'] {
  return ['GET', 'HEAD', 'OPTIONS', 'POST'].includes(method) ? method as TrackingRequest['method'] : 'OTHER'
}
