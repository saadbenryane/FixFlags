// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startScanWithHandoff } from '@/lib/audit/start-scan-handoff'

describe('startScanWithHandoff', () => {
  const navigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the Site board when siteId is present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reportId: 'report-1',
        siteId: 'site-1',
        siteUrl: '/sites/site-1',
        reportUrl: '/report/report-1',
        status: 'QUEUED',
      }),
    }))

    const result = await startScanWithHandoff({
      url: 'https://example.com',
      body: { url: 'https://example.com' },
      navigate,
    })

    expect(result).toEqual({ ok: true, reportId: 'report-1', siteId: 'site-1' })
    expect(navigate).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith('/sites/site-1')
    expect(JSON.parse(localStorage.getItem('ff:active-check')!)).toMatchObject({
      siteId: 'site-1',
      auditId: 'report-1',
    })
  })

  it('navigates to the Site board from an update-review response with siteId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reportId: 'child-1',
        parentReportId: 'parent-1',
        siteId: 'site-1',
        siteUrl: '/sites/site-1',
        reportUrl: '/report/child-1',
        status: 'QUEUED',
      }),
    }))

    const result = await startScanWithHandoff({
      url: 'https://example.com',
      endpoint: '/api/reports/parent-1/re-check',
      body: {},
      navigate,
    })

    expect(result).toEqual({ ok: true, reportId: 'child-1', siteId: 'site-1' })
    expect(navigate).toHaveBeenCalledWith('/sites/site-1')
  })

  it('fails closed when creation omits siteId (no /report fallback)', async () => {
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
      navigate,
    })

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      code: 'SITE_HANDOFF_MISSING',
    }))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('returns a recoverable error when creation omits both ids', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'QUEUED' }),
    }))

    const result = await startScanWithHandoff({
      url: 'https://example.com',
      body: { url: 'https://example.com' },
      navigate,
    })

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      code: 'SITE_HANDOFF_MISSING',
    }))
    expect(navigate).not.toHaveBeenCalled()
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
      navigate,
    })

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      status: 503,
    }))
    expect(navigate).not.toHaveBeenCalled()
  })
})
