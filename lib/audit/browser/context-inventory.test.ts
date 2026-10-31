import { describe, expect, it, vi } from 'vitest'
import type { Browser, BrowserContext } from 'playwright'
import { EventEmitter } from 'node:events'
import { browserContextInventory } from './context-inventory'
import { openAuditContext } from './context-lifetime'

describe('physical browser context inventory', () => {
  it('retains failed closing contexts, distinguishes unmanaged contexts, and releases only after physical removal', async () => {
    vi.useFakeTimers()
    const events = Object.assign(new EventEmitter(), { close: vi.fn(async () => { throw new Error('Close rejected') }) })
    const managed = events as unknown as BrowserContext
    const unmanaged = {} as BrowserContext
    const native = [managed, unmanaged]
    const browser = Object.assign(new EventEmitter(), { isConnected: () => true, contexts: () => native,
      newContext: async () => managed }) as unknown as Browser
    try {
      await openAuditContext(browser, {}, { scope: 'probe' }, async () => managed)
      expect(browserContextInventory(browser)).toMatchObject({ probe: 1, unattributed: 1, closing: 0, overdue: 0 })
      await expect(managed.close()).rejects.toThrow('Close rejected')
      expect(browserContextInventory(browser)).toMatchObject({ probe: 1, unattributed: 1, closing: 1 })
      await vi.advanceTimersByTimeAsync(30_001)
      expect(browserContextInventory(browser).overdue).toBe(1)
      native.splice(0, 1); events.emit('close')
      expect(browserContextInventory(browser)).toMatchObject({ probe: 0, unattributed: 1, closing: 0 })
    } finally { events.emit('close'); vi.useRealTimers() }
  })
})
