export const CLIENT_REQUEST_TIMEOUT_MS = 30_000

class InterruptedRequest extends Error {
  constructor() { super('Client request interrupted'); this.name = 'InterruptedRequest' }
}

/** Transport ownership covers headers and body. Cancellation ends the caller's
 * wait without establishing whether a server-side command committed. */
export async function fetchJsonWithDeadline(url: string, options: RequestInit = {}, timeoutMs = CLIENT_REQUEST_TIMEOUT_MS): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController()
  const parent = options.signal
  if (parent?.aborted) throw new InterruptedRequest()
  const abort = () => controller.abort(parent?.reason)
  parent?.addEventListener('abort', abort, { once: true })
  let rejectAbort!: () => void
  const cancelled = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(new InterruptedRequest())
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await Promise.race([cancelled, (async () => {
      const response = await fetch(url, { ...options, signal: controller.signal })
      if (controller.signal.aborted) {
        void response.body?.cancel().catch(() => { /* The transport may already have closed. */ })
        throw new InterruptedRequest()
      }
      const body: unknown = await response.json().catch(() => null)
      if (controller.signal.aborted) throw new InterruptedRequest()
      return { response, body }
    })()])
  } catch { throw new InterruptedRequest() }
  finally {
    clearTimeout(timer)
    parent?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort)
  }
}
