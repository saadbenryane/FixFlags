import { EventEmitter } from 'node:events'
import type { Browser, BrowserContext } from 'playwright'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserCapacity } from '../../progressive/capacity'
import { createAuditPage } from '../page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../capture-profile'
import { openAuditContext, auditContextDiagnostics, CONTEXT_SETUP_TIMEOUT_MS } from '../context-lifetime'
import * as executions from '../../execution-ownership'

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function controlledContext() {
  const events = new EventEmitter()
  const context = Object.assign(events, { newPage: vi.fn().mockRejectedValue(new Error('Controlled page setup failure')),
    close: vi.fn(async () => { events.emit('close') }) })
  return context
}
function controlledBrowser(newContext: () => Promise<BrowserContext>) {
  return Object.assign(new EventEmitter(), { newContext: vi.fn(newContext), isConnected: () => true, contexts: vi.fn<() => BrowserContext[]>(() => []), close: vi.fn(async () => {}) })
}
const options = () => ({ profile: DESKTOP_CAPTURE_PROFILE, settle: false, deadline: Date.now() + 50 })
const target = 'https://example.com/'
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('physical browser context lifetime', () => {
  it('attributes owned, unowned and expired native contexts without inventing resource release', async () => {
    vi.useFakeTimers()
    const owned = controlledContext(), unowned = controlledContext()
    const browser = controlledBrowser(async () => owned as unknown as BrowserContext)
    browser.contexts.mockReturnValue([owned, unowned] as unknown as BrowserContext[])
    owned.close.mockRejectedValue(new Error('Controlled physical close failure'))
    const starting = browserCapacity.running
    await openAuditContext(browser as unknown as Browser, {}, { deadline: Date.now() + 50, scope: 'task' }, async () => 'ready')
    expect(auditContextDiagnostics(browser as unknown as Browser)).toMatchObject({ ownedContexts: 1, unownedContexts: 1,
      expiredContexts: 0, reservedSlots: starting + 1, owners: [{ scope: 'task', state: 'prepared', expired: false }] })
    await vi.advanceTimersByTimeAsync(60)
    expect(auditContextDiagnostics(browser as unknown as Browser)).toMatchObject({ expiredContexts: 1,
      reservedSlots: starting + 1, owners: [{ scope: 'task', state: 'close_failed', expired: true }] })
    owned.emit('close'); browser.contexts.mockReturnValue([unowned] as unknown as BrowserContext[])
    expect(auditContextDiagnostics(browser as unknown as Browser)).toMatchObject({ ownedContexts: 0, unownedContexts: 1,
      expiredContexts: 0, reservedSlots: starting })
  })
  it('rejects allocation at the deadline, retains its physical slot and closes a late context without creating a page', async () => {
    vi.useFakeTimers()
    const pending = deferred<BrowserContext>(), context = controlledContext(), browser = controlledBrowser(() => pending.promise)
    const starting = browserCapacity.running
    let settled = false
    const capture = createAuditPage(browser as unknown as Browser, target, options()).finally(() => { settled = true })
    const result = capture.catch(error => error)
    try {
      await vi.advanceTimersByTimeAsync(60)
      expect(settled).toBe(true)
      expect(await result).toMatchObject({ code: 'AUDIT_TIMEOUT' })
      expect(browserCapacity.running).toBe(starting + 1)
    } finally {
      pending.resolve(context as unknown as BrowserContext)
      await vi.advanceTimersByTimeAsync(0)
      await result
    }
    expect(context.newPage).not.toHaveBeenCalled()
    expect(context.close).toHaveBeenCalledOnce()
    expect(browser.close).not.toHaveBeenCalled()
    expect(browserCapacity.running).toBe(starting)
  })

  it('does not allocate an already expired capture', async () => {
    const browser = controlledBrowser(async () => controlledContext() as unknown as BrowserContext)
    const result = await createAuditPage(browser as unknown as Browser, target, { ...options(), deadline: Date.now() - 1 }).catch(error => error)
    expect(result).toMatchObject({ code: 'AUDIT_TIMEOUT' })
    expect(browser.newContext).not.toHaveBeenCalled()
  })

  it('does not close the shared browser or release a live context when isolated cleanup fails', async () => {
    vi.useFakeTimers()
    const context = controlledContext(), browser = controlledBrowser(async () => context as unknown as BrowserContext)
    context.close.mockRejectedValue(new Error('Controlled close failure'))
    const starting = browserCapacity.running
    const result = await createAuditPage(browser as unknown as Browser, target, options()).catch(error => error)
    try {
      expect(result.message).toBe('Controlled page setup failure')
      expect(browser.close).not.toHaveBeenCalled()
      expect(browserCapacity.running).toBe(starting + 1)
    } finally { context.emit('close') }
    expect(browserCapacity.running).toBe(starting)
  })

  it('expires a queued capture without allocating and removes its capacity waiter', async () => {
    vi.useFakeTimers()
    const held = await Promise.all(Array.from({ length: browserCapacity.capacity }, () => browserCapacity.acquire()))
    const browser = controlledBrowser(async () => controlledContext() as unknown as BrowserContext)
    const result = createAuditPage(browser as unknown as Browser, target, options()).catch(error => error)
    try {
      await vi.advanceTimersByTimeAsync(60)
      expect(await result).toMatchObject({ code: 'AUDIT_TIMEOUT' })
      expect(browser.newContext).not.toHaveBeenCalled()
      expect(browserCapacity.queued).toBe(0)
      expect(browserCapacity.running).toBe(held.length)
    } finally { held.forEach(release => release()) }
  })

  it('releases a rejected late allocation without an unhandled rejection', async () => {
    vi.useFakeTimers()
    const pending = deferred<BrowserContext>(), browser = controlledBrowser(() => pending.promise), starting = browserCapacity.running
    const result = createAuditPage(browser as unknown as Browser, target, options()).catch(error => error)
    await vi.advanceTimersByTimeAsync(60)
    expect(await result).toMatchObject({ code: 'AUDIT_TIMEOUT' })
    pending.reject(new Error('Late native allocation failure'))
    await vi.advanceTimersByTimeAsync(0)
    expect(browserCapacity.running).toBe(starting)
    expect(browser.close).not.toHaveBeenCalled()
  })

  it('inherits execution cancellation during setup and fences late setup before configuration or navigation', async () => {
    const controller = new AbortController(), pending = deferred<never>(), cleanup = deferred<void>()
    vi.spyOn(executions, 'currentExecutionOwnership').mockReturnValue({ auditId: 'fixture', token: 'fixture', generation: 1, signal: controller.signal })
    const context = controlledContext(), browser = controlledBrowser(async () => context as unknown as BrowserContext)
    context.newPage.mockReturnValue(pending.promise)
    context.close.mockReturnValue(cleanup.promise)
    const configurePage = vi.fn(), navigation = vi.fn(), starting = browserCapacity.running
    const result = createAuditPage(browser as unknown as Browser, target, { profile: DESKTOP_CAPTURE_PROFILE, configurePage }).catch(error => error)
    try {
      await vi.waitFor(() => expect(context.newPage).toHaveBeenCalledOnce())
      controller.abort(new Error('Execution lease revoked'))
      expect((await result).message).toBe('Execution lease revoked')
      expect(browserCapacity.running).toBe(starting + 1)
      pending.resolve({ goto: navigation } as never)
      await Promise.resolve(); await Promise.resolve()
      expect(configurePage).not.toHaveBeenCalled()
      expect(navigation).not.toHaveBeenCalled()
      expect(context.close).toHaveBeenCalledOnce()
    } finally { context.emit('close'); cleanup.resolve() }
    expect(browserCapacity.running).toBe(starting)
  })

  it('retains deadline enforcement after returning a prepared context', async () => {
    vi.useFakeTimers()
    const context = controlledContext(), browser = controlledBrowser(async () => context as unknown as BrowserContext)
    const starting = browserCapacity.running
    expect(await openAuditContext(browser as unknown as Browser, {}, { deadline: Date.now() + 50 }, async () => 'prepared')).toBe('prepared')
    expect(browserCapacity.running).toBe(starting + 1)
    await vi.advanceTimersByTimeAsync(60)
    expect(context.close).toHaveBeenCalledOnce()
    expect(browserCapacity.running).toBe(starting)
  })

  it('releases pending allocation on authoritative browser disconnection', async () => {
    const pending = deferred<BrowserContext>(), context = controlledContext(), browser = controlledBrowser(() => pending.promise)
    const starting = browserCapacity.running
    const result = createAuditPage(browser as unknown as Browser, target, { profile: DESKTOP_CAPTURE_PROFILE }).catch(error => error)
    await vi.waitFor(() => expect(browser.newContext).toHaveBeenCalledOnce())
    browser.emit('disconnected')
    expect((await result).message).toBe('Audit browser disconnected')
    expect(browserCapacity.running).toBe(starting)
    pending.resolve(context as unknown as BrowserContext)
    await Promise.resolve(); await Promise.resolve()
    expect(context.close).toHaveBeenCalledOnce()
    expect(context.newPage).not.toHaveBeenCalled()
    expect(browserCapacity.running).toBe(starting)
  })


  it('checks elapsed wall time before preparing a late allocation even when timer delivery is delayed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const pending = deferred<BrowserContext>(), started = deferred<void>(), context = controlledContext()
    const browser = controlledBrowser(() => { started.resolve(); return pending.promise })
    const result = createAuditPage(browser as unknown as Browser, target, options()).catch(error => error)
    await started.promise
    vi.setSystemTime(Date.now() + 100)
    pending.resolve(context as unknown as BrowserContext)
    expect(await result).toMatchObject({ code: 'AUDIT_TIMEOUT' })
    expect(context.newPage).not.toHaveBeenCalled()
    expect(context.close).toHaveBeenCalledOnce()
  })


  it('bounds setup without an explicit deadline while keeping a prepared session open', async () => {
    vi.useFakeTimers()
    const pending = deferred<BrowserContext>(), context = controlledContext(), browser = controlledBrowser(() => pending.promise)
    const result = createAuditPage(browser as unknown as Browser, target, { profile: DESKTOP_CAPTURE_PROFILE }).catch(error => error)
    await vi.advanceTimersByTimeAsync(CONTEXT_SETUP_TIMEOUT_MS + 1)
    expect(await result).toMatchObject({ code: 'AUDIT_TIMEOUT' })
    pending.resolve(context as unknown as BrowserContext)
    await vi.advanceTimersByTimeAsync(0)
    expect(context.newPage).not.toHaveBeenCalled()
    expect(context.close).toHaveBeenCalledOnce()

    const prepared = controlledContext(), healthy = controlledBrowser(async () => prepared as unknown as BrowserContext)
    const starting = browserCapacity.running
    expect(await openAuditContext(healthy as unknown as Browser, {}, {}, async () => 'ready')).toBe('ready')
    try {
      await vi.advanceTimersByTimeAsync(CONTEXT_SETUP_TIMEOUT_MS + 1)
      expect(prepared.close).not.toHaveBeenCalled()
      expect(browserCapacity.running).toBe(starting + 1)
    } finally { await prepared.close() }
    expect(browserCapacity.running).toBe(starting)
  })


  it('does not count a repeated close acknowledgement as native removal while another close remains in progress', async () => {
    vi.useFakeTimers()
    const context = controlledContext(), browser = controlledBrowser(async () => context as unknown as BrowserContext)
    // Playwright returns early from a second close while the first is still closing.
    context.close.mockResolvedValue(undefined)
    browser.contexts.mockReturnValue([context as unknown as BrowserContext])
    const starting = browserCapacity.running
    await openAuditContext(browser as unknown as Browser, {}, { deadline: Date.now() + 50 }, async () => 'prepared')
    try {
      await vi.advanceTimersByTimeAsync(60)
      expect(context.close).toHaveBeenCalledOnce()
      expect(browserCapacity.running).toBe(starting + 1)
    } finally { context.emit('close') }
    expect(browserCapacity.running).toBe(starting)
  })

})
