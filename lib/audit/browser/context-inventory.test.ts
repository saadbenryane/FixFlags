import { describe, expect, it, vi } from 'vitest'
import type { Browser, BrowserContext } from 'playwright'
import { browserContextInventory, registerBrowserContext } from './context-inventory'

describe('physical browser context inventory', () => {
  it('retains failed closing contexts, distinguishes unmanaged contexts, and releases only after physical removal', async () => {
    const managed = { close: vi.fn(async () => { throw new Error('Close rejected') }) } as unknown as BrowserContext
    const unmanaged = {} as BrowserContext
    const native = [managed, unmanaged]
    const browser = { isConnected: () => true, contexts: () => native } as unknown as Browser
    registerBrowserContext(managed, 'probe', Date.now() - 60_000)
    expect(browserContextInventory(browser)).toMatchObject({ probe: 1, unattributed: 1, closing: 0, overdue: 1 })
    await expect(managed.close()).rejects.toThrow('Close rejected')
    expect(browserContextInventory(browser)).toMatchObject({ probe: 1, unattributed: 1, closing: 1 })
    native.splice(0, 1)
    expect(browserContextInventory(browser)).toMatchObject({ probe: 0, unattributed: 1, closing: 0 })
  })
})
