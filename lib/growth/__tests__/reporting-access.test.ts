import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, gaReport, searchReport } = vi.hoisted(() => ({ auth: vi.fn(), gaReport: vi.fn(), searchReport: vi.fn() }))
vi.mock('googleapis', () => ({ google: {
  analyticsdata: () => ({ properties: { runReport: gaReport } }),
  searchconsole: () => ({ searchanalytics: { query: searchReport } }),
} }))
vi.mock('../google-auth', () => ({ googleServiceAccount: auth }))
import { inspectFixFlagsReporting } from '../reporting-access'

describe('read-only FixFlags reporting inspection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GA4_PROPERTY_ID', '541892062')
    vi.stubEnv('GSC_PROPERTY', 'sc-domain:fixflags.com')
    auth.mockResolvedValue({ private_key: 'synthetic-private-secret' })
    gaReport.mockResolvedValue({ data: {
      metadata: { timeZone: 'Africa/Casablanca', subjectToThresholding: true },
      metricHeaders: [{ name: 'sessions' }, { name: 'unexpected-private-field' }],
      rows: [{ dimensionValues: [{ value: 'private-journey-id' }], metricValues: [{ value: '12' }, { value: 'secret@example.test' }] }],
    } })
    searchReport.mockResolvedValue({ data: { rows: [{ keys: ['private-search-query'], clicks: 2, impressions: 20, ctr: 0.1, position: 4 }] } })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('requests only aggregate reports with read-only scopes and suppresses private fields', async () => {
    const result = await inspectFixFlagsReporting('2026-09-15', '2026-10-12')
    expect(auth).toHaveBeenCalledWith([
      'https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/webmasters.readonly',
    ])
    expect(gaReport.mock.calls[0][0].requestBody.dimensions).toBeUndefined()
    expect(searchReport.mock.calls[0][0].requestBody).toMatchObject({ dimensions: [], rowLimit: 1, dataState: 'final', type: 'web' })
    expect(result.ga4).toMatchObject({ status: 'report-read-succeeded', providerLimited: true, metrics: { sessions: 12 } })
    expect(result.searchConsole).toMatchObject({ status: 'report-read-succeeded', metrics: { clicks: 2, impressions: 20 } })
    expect(result.databaseWritten).toBe(false)
    for (const secret of ['synthetic-private-secret', 'private-journey-id', 'private-search-query', 'secret@example.test']) expect(JSON.stringify(result)).not.toContain(secret)
  })

  it('preserves a working provider result without serializing the other provider exception', async () => {
    gaReport.mockRejectedValue(new Error('signed credential synthetic-secret'))
    const result = await inspectFixFlagsReporting('2026-09-15', '2026-10-12')
    expect(result.ga4).toEqual({ status: 'report-read-failed' })
    expect(result.searchConsole.status).toBe('report-read-succeeded')
    expect(JSON.stringify(result)).not.toContain('synthetic-secret')
  })

  it('does not substitute zero metrics for an empty report', async () => {
    gaReport.mockResolvedValue({ data: {} })
    searchReport.mockResolvedValue({ data: {} })
    const result = await inspectFixFlagsReporting('2026-09-15', '2026-10-12')
    expect(result.ga4).toMatchObject({ metrics: {} })
    expect(result.searchConsole).toMatchObject({ metrics: null })
  })

  it('rejects unrelated properties and malformed windows before credential use', async () => {
    await expect(inspectFixFlagsReporting('2026-02-30', '2026-10-12')).rejects.toThrow('Invalid reporting date')
    await expect(inspectFixFlagsReporting('2026-10-12', '2026-09-15')).rejects.toThrow('Invalid reporting window')
    vi.stubEnv('GA4_PROPERTY_ID', 'unrelated-property')
    await expect(inspectFixFlagsReporting('2026-09-15', '2026-10-12')).rejects.toThrow('FixFlags reporting properties are not configured')
    expect(auth).not.toHaveBeenCalled()
    expect(gaReport).not.toHaveBeenCalled()
  })
})
