import { createServer } from 'node:http'
import type { BrowserContext } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { browserCapacity } from '../progressive/capacity'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { createAuditPage } from './page-session'
import { DESKTOP_CAPTURE_PROFILE } from './capture-profile'
import * as executions from '../execution-ownership'

const native = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
native('native browser context lifetime isolation', () => {
  let origin: string
  const requests: string[] = []
  const server = createServer((request, response) => {
    requests.push(request.url!)
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html><head><title>Context lifetime fixture</title></head><body><h1>Independent page</h1></body></html>')
  })
  beforeAll(async () => {
    expect(browserCapacity.capacity).toBe(2)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  })
  afterAll(async () => {
    vi.restoreAllMocks()
    await closeBrowser()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })
  const options = () => ({ profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false, deadline: Date.now() + 10_000 })

  it('closes a delayed native allocation after its caller expires while a sibling page remains usable', async () => {
    const browser = await getAuditBrowser()
    const sibling = await createAuditPage(browser, origin + '/sibling', options())
    const original = browser.newContext.bind(browser)
    let release!: () => void, late: BrowserContext | undefined
    const delayed = new Promise<void>(resolve => { release = resolve })
    const allocate = vi.spyOn(browser, 'newContext').mockImplementationOnce(async input => {
      await delayed
      late = await original(input)
      vi.spyOn(late, 'newPage')
      return late
    })
    const capture = createAuditPage(browser, origin + '/late', { ...options(), deadline: Date.now() + 100 }).catch(error => error)
    try {
      expect(await capture).toMatchObject({ code: 'AUDIT_TIMEOUT' })
      expect(browserCapacity.running).toBe(2)
      expect(browser.contexts()).toHaveLength(1)
      expect(await sibling.page.locator('h1').textContent()).toBe('Independent page')
      release()
      await vi.waitFor(() => {
        expect(late).toBeDefined()
        expect(browser.contexts()).toHaveLength(1)
        expect(browserCapacity.running).toBe(1)
      })
      expect(late!.newPage).not.toHaveBeenCalled()
      expect(requests).not.toContain('/late')
      const next = await createAuditPage(browser, origin + '/after-late-close', options())
      try { expect(await next.page.locator('h1').textContent()).toBe('Independent page') }
      finally { await next.page.context().close() }
    } finally {
      release(); await capture
      allocate.mockRestore()
      await sibling.page.context().close()
      await vi.waitFor(() => expect(browserCapacity.running).toBe(0))
    }
  })

  it('retains physical capacity after a rejected close and keeps sibling contexts alive', async () => {
    const browser = await getAuditBrowser()
    const sibling = await createAuditPage(browser, origin + '/other-sibling', options())
    const original = browser.newContext.bind(browser)
    let failed: BrowserContext | undefined, closeFailed: (() => Promise<void>) | undefined
    const allocate = vi.spyOn(browser, 'newContext').mockImplementationOnce(async input => {
      failed = await original(input)
      closeFailed = failed.close.bind(failed)
      vi.spyOn(failed, 'close').mockRejectedValue(new Error('Controlled native close acknowledgement failure'))
      return failed
    })
    const sharedClose = vi.spyOn(browser, 'close')
    try {
      await expect(createAuditPage(browser, origin + '/failed-setup', { ...options(), configurePage: async () => {
        throw new Error('Controlled setup failure')
      } })).rejects.toThrow('Controlled setup failure')
      expect(sharedClose).not.toHaveBeenCalled()
      expect(browser.isConnected()).toBe(true)
      expect(browser.contexts()).toHaveLength(2)
      expect(browserCapacity.running).toBe(2)
      expect(await sibling.page.locator('h1').textContent()).toBe('Independent page')
      expect(requests).not.toContain('/failed-setup')
      await closeFailed!()
      await vi.waitFor(() => expect(browserCapacity.running).toBe(1))
      const next = await createAuditPage(browser, origin + '/after-failed-close', options())
      try { expect(await next.page.locator('h1').textContent()).toBe('Independent page') }
      finally { await next.page.context().close() }
    } finally {
      allocate.mockRestore(); sharedClose.mockRestore()
      await closeFailed?.()
      await sibling.page.context().close()
      await vi.waitFor(() => expect(browserCapacity.running).toBe(0))
    }
  })

  it('refuses a physical request when cancellation arrives during its asynchronous admission', async () => {
    const browser = await getAuditBrowser(), controller = new AbortController()
    const original = browser.newContext.bind(browser)
    let release!: () => void, entered!: () => void, closeFailed: (() => Promise<void>) | undefined
    const admission = new Promise<void>(resolve => { release = resolve }), admitting = new Promise<void>(resolve => { entered = resolve })
    const failedRequest = vi.fn()
    const allocate = vi.spyOn(browser, 'newContext').mockImplementationOnce(async input => {
      const context = await original(input)
      closeFailed = context.close.bind(context)
      vi.spyOn(context, 'close').mockRejectedValue(new Error('Controlled native close failure'))
      return context
    })
    const ownership = vi.spyOn(executions, 'currentExecutionOwnership').mockReturnValue({ auditId: 'native-fixture', token: 'fixture', generation: 1, signal: controller.signal })
    const capture = createAuditPage(browser, origin + '/cancelled-admission', { ...options(),
      configurePage: async page => { page.on('requestfailed', failedRequest) },
      requestPolicy: async request => {
        if (request.navigation) { entered(); await admission }
        return true
      },
    }).catch(error => error)
    try {
      await admitting
      controller.abort(new Error('Controlled execution revoked'))
      expect((await capture).message).toBe('Controlled execution revoked')
      expect(browserCapacity.running).toBe(1)
      release()
      await vi.waitFor(() => expect(failedRequest).toHaveBeenCalled())
      expect(requests).not.toContain('/cancelled-admission')
      expect(browser.isConnected()).toBe(true)
    } finally {
      release(); ownership.mockRestore(); allocate.mockRestore()
      await closeFailed?.()
      await vi.waitFor(() => expect(browserCapacity.running).toBe(0))
    }
  })


  it('keeps a context slot while a caller-owned native close is still in progress', async () => {
    const browser = await getAuditBrowser(), controller = new AbortController()
    const ownership = vi.spyOn(executions, 'currentExecutionOwnership').mockReturnValue({ auditId: 'closing-fixture', token: 'fixture', generation: 1, signal: controller.signal })
    const session = await createAuditPage(browser, origin + '/closing-context', options())
    ownership.mockRestore()
    const context = session.page.context(), originalDispose = context.request.dispose.bind(context.request)
    let release!: () => void, entered!: () => void
    const held = new Promise<void>(resolve => { release = resolve }), disposing = new Promise<void>(resolve => { entered = resolve })
    const dispose = vi.spyOn(context.request, 'dispose').mockImplementationOnce(async options => {
      entered(); await held; await originalDispose(options)
    })
    const closing = context.close()
    try {
      await disposing
      controller.abort(new Error('Execution ended during native close'))
      // The repeated close resolves immediately in this installed Playwright version.
      await context.close()
      await new Promise<void>(resolve => setImmediate(resolve))
      expect(browser.contexts()).toContain(context)
      expect(browserCapacity.running).toBe(1)
      release(); await closing
      await vi.waitFor(() => expect(browserCapacity.running).toBe(0))
      expect(browser.contexts()).not.toContain(context)
    } finally { release(); await closing; dispose.mockRestore(); ownership.mockRestore() }
  })

})
