import { describe, expect, it, vi } from 'vitest'
import type { Page } from 'playwright'
import { runFlowScan } from '@/lib/audit/flow/run-flow-scan'

describe('runFlowScan deadline', () => {
  it('closes the page and returns timeout when a nested Playwright operation hangs', async () => {
    let closed = false
    const page = {
      screenshot: vi.fn(() => new Promise(() => {})),
      isClosed: vi.fn(() => closed),
      url: vi.fn(() => 'https://example.com/'),
      close: vi.fn(async () => {
        closed = true
      }),
    } as unknown as Page

    const started = Date.now()
    const result = await runFlowScan(page, 'audit-1', 'https://example.com/', {
      deadlineMs: 20,
    })

    expect(result.status).toBe('timeout')
    expect(Date.now() - started).toBeLessThan(500)
    expect(page.close).toHaveBeenCalledOnce()
  })
})
