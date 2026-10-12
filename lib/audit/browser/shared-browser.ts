import type { Browser } from 'playwright'

/** One browser process per worker, including concurrent first use and shutdown. */
export function sharedBrowser(launch: () => Promise<Browser>) {
  let current: Browser | null = null
  let launching: Promise<Browser> | null = null
  let closing: Promise<void> | null = null
  async function get(): Promise<Browser> {
    if (closing) await closing
    if (current?.isConnected()) return current
    if (!launching) launching = (async () => {
      if (current) await current.close()
      const opened = await launch()
      current = opened
      opened.on('disconnected', () => { if (current === opened) current = null })
      return opened
    })()
    const pending = launching
    try { return await pending }
    finally { if (launching === pending) launching = null }
  }
  async function close(): Promise<void> {
    if (!closing) closing = (async () => {
      // A launch failure has no process to close. Its caller receives the error.
      const opened = launching ? await launching.catch(() => null) : current
      current = null
      if (opened) await opened.close()
    })()
    const pending = closing
    try { await pending }
    finally { if (closing === pending) closing = null }
  }
  return { get, close, peek: () => current }
}
