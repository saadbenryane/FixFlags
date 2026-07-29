// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startScanWithHandoff } from '@/lib/audit/start-scan-handoff'

describe('startScanWithHandoff', () => {
  const replace = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    vi.stubGlobal('window', {
      location: { replace },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the created report without publishing foreground active-audit state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reportId: 'report-1',
        reportUrl: '/report/report-1',
        status: 'QUEUED',
      }),
    }))

    const result = await startScanWithHandoff({
      url: 'https://example.com',
      body: { url: 'https://example.com' },
    })

    expect(result).toEqual({ ok: true, reportId: 'report-1' })
    expect(replace).toHaveBeenCalledOnce()
    expect(replace).toHaveBeenCalledWith('/report/report-1')
    expect(localStorage.getItem('ff:active-check')).toBeNull()
    expect(sessionStorage.getItem('ff:active-check')).toBeNull()
  })

  it('returns a recoverable error when creation omits the report id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'QUEUED' }),
    }))

    const result = await startScanWithHandoff({
      url: 'https://example.com',
      body: { url: 'https://example.com' },
    })

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      code: 'REPORT_HANDOFF_MISSING',
    }))
    expect(replace).not.toHaveBeenCalled()
  })

  it('keeps API failures on the originating control', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Workers are unavailable.' }),
    }))

    const result = await startScanWithHandoff({
      url: 'https://example.com',
      body: { url: 'https://example.com' },
    })

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      status: 503,
    }))
    expect(replace).not.toHaveBeenCalled()
  })
})
