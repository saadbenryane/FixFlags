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
    vi.useRealTimers()
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

  it('opens an admitted Site even when optional start analytics throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ siteId: 'site-1', reportId: 'audit-1' })))
    const onStarted = vi.fn(() => { throw new Error('Analytics unavailable') })
    await expect(startScanWithHandoff({ url: 'https://example.com', body: { url: 'https://example.com' }, navigate, onStarted }))
      .resolves.toMatchObject({ ok: true, siteId: 'site-1' })
    expect(onStarted).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/sites/site-1')
  })

  it('preserves a consumed API error body and its plan action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Choose a plan for another Site.',
      code: 'SITE_LIMIT', action: 'upgrade' }, { status: 402 })))
    await expect(startScanWithHandoff({ url: 'https://example.com', body: {}, navigate })).resolves.toEqual({
      ok: false, status: 402, code: 'SITE_LIMIT', action: 'upgrade', message: 'Choose a plan for another Site.',
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not call a refused platform request queued when its body supplies no admission evidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Platform rate limit', { status: 429, headers: { 'Retry-After': '90' } })))
    const result = await startScanWithHandoff({ url: 'https://example.com', body: {}, navigate })
    expect(result).toMatchObject({ ok: false, status: 429, code: 'RATE_LIMITED' })
    if (result.ok) throw new Error('Expected refusal')
    expect(result.message).toContain('2 minutes')
    expect(result.message).not.toMatch(/queued/i)
    expect(result.action).not.toBe('queued')
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each(['headers', 'body'] as const)('releases a stalled %s request without handing off its late result', async phase => {
    vi.useFakeTimers()
    let finishHeaders!: (response: Response) => void, finishBody!: (body: unknown) => void
    const onStarted = vi.fn()
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finishHeaders = resolve })))
    let completed = false
    const pending = startScanWithHandoff({ url: 'https://example.com', body: {}, navigate, onStarted })
      .then(result => { completed = true; return result })
    await vi.advanceTimersByTimeAsync(20_000)
    if (phase === 'body') {
      finishHeaders({ ok: true, json: () => new Promise(resolve => { finishBody = resolve }) } as Response)
      await vi.advanceTimersByTimeAsync(0)
    }
    await vi.advanceTimersByTimeAsync(10_000)
    expect(completed).toBe(true)
    expect(await pending).toMatchObject({ ok: false })
    if (phase === 'headers') finishHeaders(Response.json({ siteId: 'late-site' }))
    else finishBody({ siteId: 'late-site' })
    await vi.advanceTimersByTimeAsync(0)
    expect(navigate).not.toHaveBeenCalled()
    expect(onStarted).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
