import type { Browser } from 'playwright'
import { describe, expect, it, vi } from 'vitest'
import { sharedBrowser } from './shared-browser'

function browserFixture() {
  let connected = true
  let disconnect = () => {}
  const close = vi.fn(async () => { connected = false; disconnect() })
  const browser = { close, isConnected: () => connected,
    on: (_event: string, callback: () => void) => { disconnect = callback } } as unknown as Browser
  return { browser, close, disconnect: () => { connected = false; disconnect() } }
}
describe('worker browser lifecycle', () => {
  it('shares one process across simultaneous first use and closes it once', async () => {
    const fixture = browserFixture(), launch = vi.fn(async () => fixture.browser)
    const runtime = sharedBrowser(launch)
    expect(await Promise.all(Array.from({ length: 8 }, () => runtime.get()))).toEqual(Array(8).fill(fixture.browser))
    expect(launch).toHaveBeenCalledOnce()
    await Promise.all([runtime.close(), runtime.close()])
    expect(fixture.close).toHaveBeenCalledOnce()
    expect(runtime.peek()).toBeNull()
  })
  it('waits for an admitted launch during shutdown instead of orphaning its process', async () => {
    const fixture = browserFixture()
    let finish!: (browser: Browser) => void
    const runtime = sharedBrowser(() => new Promise(resolve => { finish = resolve }))
    const pending = runtime.get(), closing = runtime.close()
    finish(fixture.browser)
    await pending; await closing
    expect(fixture.close).toHaveBeenCalledOnce()
    expect(runtime.peek()).toBeNull()
  })
  it('relaunches after a disconnected process without reusing its closed handle', async () => {
    const first = browserFixture(), second = browserFixture()
    const launch = vi.fn().mockResolvedValueOnce(first.browser).mockResolvedValueOnce(second.browser)
    const runtime = sharedBrowser(launch)
    await runtime.get(); first.disconnect()
    expect(await runtime.get()).toBe(second.browser)
    expect(launch).toHaveBeenCalledTimes(2)
    await runtime.close()
  })
  it('reports launch failure to every caller and permits a later fresh launch', async () => {
    const fixture = browserFixture(), error = new Error('Chromium unavailable')
    const launch = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(fixture.browser)
    const runtime = sharedBrowser(launch)
    const results = await Promise.allSettled([runtime.get(), runtime.get()])
    expect(results).toEqual([{ status: 'rejected', reason: error }, { status: 'rejected', reason: error }])
    expect(launch).toHaveBeenCalledOnce()
    expect(await runtime.get()).toBe(fixture.browser)
    await runtime.close()
  })
})
