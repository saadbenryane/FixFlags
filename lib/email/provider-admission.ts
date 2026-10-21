import { setTimeout as delay } from 'node:timers/promises'
import { tryAcquireLock } from '@/lib/queue/lock'

// The default provider allowance is 10 requests/second across the whole team,
// including different API keys. Leave headroom instead of bursting at the limit.
const REQUEST_SPACING_MS = 125
const ADMISSION_TIMEOUT_MS = 5000

/** Shared web and worker admission, without reserving an unbounded future queue.
 * Failed or cancelled admission never authorizes a later physical request. */
export async function waitForEmailProviderCapacity(parentSignal?: AbortSignal | null) {
  const controller = new AbortController()
  const signal = parentSignal ? AbortSignal.any([parentSignal, controller.signal]) : controller.signal
  const timer = setTimeout(() => controller.abort(new Error('Email provider capacity is temporarily unavailable')), ADMISSION_TIMEOUT_MS)
  let abort: () => void = () => {}
  try {
    signal.throwIfAborted()
    await Promise.race([
      (async () => {
        for (;;) {
          signal.throwIfAborted()
          const acquired = await tryAcquireLock('resend-api', REQUEST_SPACING_MS)
          signal.throwIfAborted()
          if (acquired) return
          await delay(REQUEST_SPACING_MS, undefined, { signal })
        }
      })(),
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      }),
    ])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
    controller.abort()
  }
}
