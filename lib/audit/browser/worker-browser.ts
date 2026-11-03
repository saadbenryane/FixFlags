import { randomUUID } from 'node:crypto'
import { chromium, type Browser, type LaunchOptions } from 'playwright'

type Reply = { type: 'fixflags:browser-result'; id: string; endpoint?: string; closed?: boolean; error?: string }

/** Use the bootstrap's physical browser owner only on its private IPC channel.
 * Direct development and library callers keep the existing local launch. */
export async function launchWorkerBrowser(options: LaunchOptions): Promise<Browser> {
  if (process.env.FIXFLAGS_SUPERVISED_BROWSER !== 'true') return chromium.launch(options)
  if (!process.connected || !process.send) throw new Error('The managed browser supervisor is unavailable')
  const request = (action: 'launch' | 'close'): Promise<Reply> => new Promise((resolve, reject) => {
    const id = randomUUID()
    const finish = (error?: Error, result?: Reply) => {
      clearTimeout(timer); process.off('message', receive); process.off('disconnect', disconnected)
      if (error) reject(error); else resolve(result!)
    }
    const receive = (message: unknown) => {
      const reply = message as Reply | null
      if (reply?.type === 'fixflags:browser-result' && reply.id === id)
        finish(reply.error ? new Error(reply.error) : undefined, reply)
    }
    const disconnected = () => finish(new Error('The managed browser supervisor disconnected'))
    const timer = setTimeout(() => finish(new Error('The managed browser supervisor timed out')), 35_000)
    process.on('message', receive); process.once('disconnect', disconnected)
    process.send!({ type: 'fixflags:browser', id, action, ...(action === 'launch' ? { options } : {}) }, error => {
      if (error) finish(error)
    })
  })
  try {
    const result = await request('launch')
    if (!result.endpoint?.startsWith('ws://127.0.0.1:')) throw new Error('Invalid managed browser endpoint')
    const browser = await chromium.connect(result.endpoint, { timeout: 30_000 })
    const disconnect = browser.close.bind(browser)
    let closing: Promise<void> | undefined
    const close = () => closing ??= request('close').then(() => disconnect())
    browser.close = close
    browser.once('disconnected', () => { void close().catch(() => undefined) })
    return browser
  } catch (error) {
    await request('close').catch(() => undefined)
    throw error
  }
}
