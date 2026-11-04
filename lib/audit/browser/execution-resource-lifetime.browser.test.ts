import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { withExecutionOwnership } from '../execution-ownership'
import { browserCapacity } from '../progressive/capacity'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { createAuditPage } from './page-session'
import { DESKTOP_CAPTURE_PROFILE } from './capture-profile'

vi.mock('@/lib/db', () => ({ prisma: { audit: { updateMany: vi.fn(async () => ({ count: 1 })) },
  $queryRaw: vi.fn(async () => [{ id: 'native-owner' }]) } }))
const native = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip

native('execution scope owns native resource retirement', () => {
  let origin: string
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><title>Resource custody</title><h1>Independent Site</h1>')
  })
  beforeAll(async () => {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  })
  afterAll(async () => {
    await closeBrowser(); server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })
  it.each([false, true])('closes a prepared context on scope settlement and preserves its sibling (failed=%s)', async failed => {
    const browser = await getAuditBrowser()
    const options = { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false }
    const sibling = await createAuditPage(browser, origin, options)
    try {
      const execution = withExecutionOwnership({ auditId: 'native-owner', token: 'fixture-token', generation: 1 }, async () => {
        await createAuditPage(browser, origin, options)
        expect(browser.contexts()).toHaveLength(2)
        if (failed) throw new Error('Controlled execution failure')
        return 'recorded'
      })
      if (failed) await expect(execution).rejects.toThrow('Controlled execution failure')
      else await expect(execution).resolves.toBe('recorded')
      await vi.waitFor(() => {
        expect(browser.contexts()).toHaveLength(1)
        expect(browserCapacity.running).toBe(1)
      })
      expect(await sibling.page.locator('h1').textContent()).toBe('Independent Site')
    } finally { await sibling.page.context().close() }
  })
})
