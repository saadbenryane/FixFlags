import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { report, persist, auth } = vi.hoisted(() => ({ report: vi.fn(), persist: vi.fn(), auth: vi.fn() }))
vi.mock('googleapis', () => ({ google: { analyticsdata: () => ({ properties: { runReport: report } }) } }))
vi.mock('@/lib/growth/google-auth', () => ({ googleServiceAccount: auth }))
vi.mock('@/lib/growth/artifacts', () => ({ persistGrowthArtifact: persist }))
import { runGaPull } from '../ga-pull'

describe('GA report provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GA4_PROPERTY_ID', 'synthetic-property')
    auth.mockResolvedValue({})
  })
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    { timeZone: 'Africa/Casablanca' },
    { timeZone: 'America/New_York', subjectToThresholding: true },
    { timeZone: 'UTC', dataLossFromOtherRow: true },
    { timeZone: 'UTC', samplingMetadatas: [{ samplesReadCount: '50', samplingSpaceSize: '100' }] },
  ])('keeps the reporting timezone and limitations from the actual landing report', async (metadata) => {
    report.mockImplementation(async ({ requestBody }) => ({ data: {
      metadata,
      rows: requestBody.dimensions[0]?.name === 'customEvent:journey_id'
        ? [{ dimensionValues: [{ value: `ffj_${'a'.repeat(32)}` }], metricValues: [{ value: '1' }] }]
        : [],
    } }))
    const result = await runGaPull()
    expect(result?.landingJourneys.reportingTimeZone).toBe(metadata.timeZone)
    expect(result?.landingJourneys.status).toBe(Object.keys(metadata).length > 1 ? 'partial' : 'available')
    expect(persist).toHaveBeenCalledWith('ga-landing-journeys', 'ga/rolling-28d/landing-journeys', result?.landingJourneys)
  })

  it('does not invent reporting timezone metadata when GA omits it', async () => {
    report.mockResolvedValue({ data: { rows: [] } })
    expect((await runGaPull())?.landingJourneys.reportingTimeZone).toBeNull()
  })

  it('requests exactly the declared number of inclusive calendar dates', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'))
    try {
      report.mockResolvedValue({ data: { rows: [] } })
      const result = await runGaPull({ days: 1 })
      expect(report.mock.calls[0][0].requestBody.dateRanges).toEqual([{ startDate: '2026-10-13', endDate: '2026-10-13' }])
      expect(result?.summary).toMatchObject({ startDate: '2026-10-13', endDate: '2026-10-13' })
    } finally {
      vi.useRealTimers()
    }
  })
})
