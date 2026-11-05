export const CLIENT_REQUEST_TIMEOUT_MS = 30_000

class InterruptedRequest extends Error {
  constructor() { super('Client request interrupted'); this.name = 'InterruptedRequest' }
}

/** Bound caller ownership while passing cancellation through the native operation.
 * Interruption does not establish whether a server-side command committed.
 * A null timeout uses only the caller's lifetime; nested operations retain their own deadlines. */
export async function withClientDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal | null, timeoutMs: number | null = CLIENT_REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  if (parent?.aborted) throw new InterruptedRequest()
  const abort = () => controller.abort(parent?.reason)
  parent?.addEventListener('abort', abort, { once: true })
  let rejectAbort!: () => void
  const cancelled = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(new InterruptedRequest())
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
  })
  const timer = timeoutMs === null ? undefined : setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await Promise.race([cancelled, operation(controller.signal)])
  } catch { throw new InterruptedRequest() }
  finally {
    if (timer !== undefined) clearTimeout(timer)
    parent?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort)
  }
}

/** Headers and body share the same operation deadline. */
export function fetchJsonWithDeadline(url: string, options: RequestInit = {}, timeoutMs = CLIENT_REQUEST_TIMEOUT_MS): Promise<{ response: Response; body: unknown }> {
  return withClientDeadline(async signal => {
    const response = await fetch(url, { ...options, signal })
    if (signal.aborted) {
      void response.body?.cancel().catch(() => { /* The transport may already have closed. */ })
      throw new InterruptedRequest()
    }
    const body: unknown = await response.json().catch(() => null)
    if (signal.aborted) throw new InterruptedRequest()
    return { response, body }
  }, options.signal, timeoutMs)
}
