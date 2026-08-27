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
      navigate,
    })

    expect(result).toEqual({ ok: true, reportId: 'report-1' })
    expect(navigate).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith('/report/report-1')
    expect(localStorage.getItem('ff:active-check')).toBeNull()
    expect(sessionStorage.getItem('ff:active-check')).toBeNull()
  })

  it('navigates to the work report id from an update-review response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reportId: 'child-1',
        parentReportId: 'parent-1',
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

    expect(result).toEqual({ ok: true, reportId: 'child-1' })
    expect(navigate).toHaveBeenCalledWith('/report/child-1')
  })

  it('returns a recoverable error when creation omits the report id', async () => {
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
      code: 'REPORT_HANDOFF_MISSING',
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
