import { describe, expect, it, vi } from 'vitest'
import type { Page } from 'playwright'
import { captureScreenshot } from './capture-screenshot'
import { AuditDeadlineError } from '../pipeline-errors'

describe('bounded screenshot operation', () => {
  it.each([undefined, 0, Infinity, NaN, -1, 30_000])('keeps a finite capture limit for timeout %s', async timeout => {
    const screenshot = vi.fn<Page['screenshot']>().mockResolvedValue(Buffer.from('png'))
    await captureScreenshot({ screenshot } as unknown as Page, { type: 'png', fullPage: false, timeout })
    expect(screenshot).toHaveBeenCalledWith({ type: 'png', fullPage: false, timeout: 5000 })
  })
  it('uses the shorter caller or parent limit and preserves capture options', async () => {
    const screenshot = vi.fn<Page['screenshot']>().mockResolvedValue(Buffer.from('png'))
    const page = { screenshot } as unknown as Page
    await captureScreenshot(page, { type: 'jpeg', quality: 70, timeout: 500 })
    expect(screenshot).toHaveBeenLastCalledWith({ type: 'jpeg', quality: 70, timeout: 500 })
    await captureScreenshot(page, { type: 'png', timeout: 1500 }, Date.now() + 100)
    expect(screenshot.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'png', timeout: expect.any(Number) })
    const timeout = screenshot.mock.calls.at(-1)?.[0]?.timeout
    expect(timeout).toBeGreaterThan(0)
    expect(timeout).toBeLessThanOrEqual(100)
  })
  it('refuses to start a physical capture after its deadline', async () => {
    const screenshot = vi.fn<Page['screenshot']>().mockResolvedValue(Buffer.from('png'))
    await expect(captureScreenshot({ screenshot } as unknown as Page, { type: 'png' }, Date.now() - 1)).rejects.toBeInstanceOf(AuditDeadlineError)
    expect(screenshot).not.toHaveBeenCalled()
  })
})
