import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { report, persist, auth, events, audits, readOnly, transaction } = vi.hoisted(() => ({
  report: vi.fn(), persist: vi.fn(), auth: vi.fn(), events: vi.fn(), audits: vi.fn(), readOnly: vi.fn(), transaction: vi.fn(),
}))
vi.mock('googleapis', () => ({ google: { analyticsdata: () => ({ properties: { runReport: report } }) } }))
vi.mock('@/lib/growth/google-auth', () => ({ googleServiceAccount: auth }))
vi.mock('@/lib/growth/artifacts', () => ({ persistGrowthArtifact: persist }))
vi.mock('@/lib/db', () => ({ prisma: { $transaction: transaction } }))
import { inspectFixFlagsLandingJourneys, runGaPull } from '../ga-pull'
import { FIXFLAGS_LANDING_SCOPE } from '../reporting-targets'

describe('GA report provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GA4_PROPERTY_ID', '541892062')
    auth.mockResolvedValue({})
    events.mockReset().mockResolvedValue([])
    audits.mockReset().mockResolvedValue([])
    transaction.mockImplementation(run => run({ $executeRaw: readOnly, audit: { findMany: audits },
      siteLifecycleEvent: { findMany: events } }))
  })
  afterEach(() => vi.unstubAllEnvs())

  it('reads a fixed landing window through one provider query and an aggregate-only database join', async () => {
    const window = { startDate: '2026-10-04', endDate: '2026-10-31' }
    const privateJourney = `ffj_${'b'.repeat(32)}`
    report.mockResolvedValue({ data: { metadata: { timeZone: 'UTC' }, rowCount: 1,
      rows: [{ dimensionValues: [{ value: privateJourney }], metricValues: [{ value: '1' }] }] } })
    events.mockResolvedValueOnce([
      { idempotencyKey: 'analyze_started:private-match', createdAt: new Date('2026-10-09T12:00:00Z'),
        properties: { anonymous: true, journeyId: privateJourney } },
      { idempotencyKey: 'analyze_started:private-other', createdAt: new Date('2026-10-09T12:00:00Z'),
        properties: { anonymous: true, journeyId: `ffj_${'c'.repeat(32)}` } },
      { idempotencyKey: 'analyze_started:private-unkeyed', createdAt: new Date('2026-10-09T12:00:00Z'), properties: { anonymous: true } },
      { idempotencyKey: 'analyze_started:private-before', createdAt: new Date('2026-10-03T12:00:00Z'), properties: { anonymous: true } },
    ])
    const result = await inspectFixFlagsLandingJourneys(window, { $transaction: transaction })
    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0][0]).toMatchObject({ property: 'properties/541892062', requestBody: { dateRanges: [window] } })
    expect(auth).toHaveBeenCalledWith(['https://www.googleapis.com/auth/analytics.readonly'])
    expect(readOnly.mock.calls[0][0].join('')).toBe('SET TRANSACTION READ ONLY')
    expect(result).toMatchObject({ ...window, scope: FIXFLAGS_LANDING_SCOPE, landingSessions: 1, startedSessions: 1,
      startReceiptCoverage: { retainedStarts: 3, withUsableTabKey: 2, withExactLandingMatch: 1 } })
    expect(audits).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['private-match'] } } }))
    expect(JSON.stringify(result)).not.toMatch(/ffj_|private-/)
    expect(persist).not.toHaveBeenCalled()
    vi.stubEnv('GA4_PROPERTY_ID', 'unrelated-property')
    await expect(inspectFixFlagsLandingJourneys(window, { $transaction: transaction })).rejects.toThrow('FixFlags GA4 property required')
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('counts retained starts in a comparable window even when GA4 returns no tab keys', async () => {
    report.mockResolvedValue({ data: { metadata: { timeZone: 'UTC' }, rowCount: 0, rows: [] } })
    events.mockResolvedValueOnce([{ idempotencyKey: 'analyze_started:private-unkeyed', createdAt: new Date('2026-10-09T12:00:00Z'),
      properties: { anonymous: true } }])
    const result = await inspectFixFlagsLandingJourneys({ startDate: '2026-10-04', endDate: '2026-10-31' }, { $transaction: transaction })
    expect(result).toMatchObject({ landingSessions: 0, startRate: null,
      startReceiptCoverage: { retainedStarts: 1, withUsableTabKey: 0, withExactLandingMatch: 0 } })
    expect(audits).not.toHaveBeenCalled()
  })

  it.each([
    ['a non-UTC timezone', { timeZone: 'Africa/Casablanca' }],
    ['thresholding', { timeZone: 'America/New_York', subjectToThresholding: true }],
    ['other-row data loss', { timeZone: 'UTC', dataLossFromOtherRow: true }],
    ['sampling', { timeZone: 'UTC', samplingMetadatas: [{ samplesReadCount: '50', samplingSpaceSize: '100' }] }],
    ['retention truncation', { timeZone: 'UTC', dataTruncationReasons: [{ dataTruncationType: 'DATA_RETENTION' }] }],
  ])('keeps the reporting timezone and limitations from the actual landing report: %s', async (_limitation, metadata) => {
    report.mockImplementation(async ({ requestBody }) => ({ data: {
      metadata,
      rows: requestBody.dimensions[0]?.name === 'customEvent:journey_id'
        ? [{ dimensionValues: [{ value: `ffj_${'a'.repeat(32)}` }], metricValues: [{ value: '1' }] }]
        : [],
    } }))
    const result = await runGaPull()
    expect(result?.landingJourneys?.reportingTimeZone).toBe(metadata.timeZone)
    expect(result?.landingJourneys?.status).toBe(Object.keys(metadata).length > 1 ? 'partial' : 'available')
    expect(persist).toHaveBeenCalledWith('ga-landing-journeys', 'ga/rolling-28d/landing-journeys', result?.landingJourneys)
  })

  it('retains a visible landing tab without deriving a share from omitted provider rows', async () => {
    report.mockImplementation(async ({ requestBody }) => ({ data: {
      metadata: { timeZone: 'UTC' },
      ...(requestBody.dimensions[0]?.name === 'customEvent:journey_id' ? {
        rowCount: 2, rows: [{ dimensionValues: [{ value: `ffj_${'a'.repeat(32)}` }], metricValues: [{ value: '1' }] }],
      } : { rows: [] }),
    } }))
    const result = await runGaPull()
    expect(result?.landingJourneys).toMatchObject({ status: 'partial', providerLimited: true, landingSessions: 1, startRate: null })
    expect(JSON.stringify(persist.mock.calls)).not.toContain('ffj_')
  })

  it('does not invent reporting timezone metadata when GA omits it', async () => {
    report.mockResolvedValue({ data: { rows: [] } })
    expect((await runGaPull())?.landingJourneys?.reportingTimeZone).toBeNull()
  })

  it('pins the property and filters the journey export to the exact production homepage stream', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', ' properties/541892062 ')
    report.mockImplementation(async () => {
      vi.stubEnv('GA4_PROPERTY_ID', 'other-property')
      return { data: { metadata: { timeZone: 'UTC' }, rows: [] } }
    })
    const result = await runGaPull({ excludeCountries: ['France'] })
    expect(report.mock.calls.map(([request]) => request.property)).toEqual(Array(5).fill('properties/541892062'))
    const landingRequest = report.mock.calls[1][0].requestBody
    expect(landingRequest.dimensions).toEqual([{ name: 'customEvent:journey_id' }])
    expect(landingRequest.dimensionFilter.andGroup.expressions[0]).toMatchObject({
      notExpression: { filter: { fieldName: 'country', stringFilter: { value: 'France' } } },
    })
    const scopeFilters = landingRequest.dimensionFilter.andGroup.expressions[1].andGroup.expressions
    expect(scopeFilters.map(({ filter }: { filter: { fieldName: string; stringFilter: object } }) =>
      [filter.fieldName, filter.stringFilter])).toEqual([
      ['hostName', { matchType: 'EXACT', caseSensitive: true, value: 'fixflags.com' }],
      ['streamId', { matchType: 'EXACT', caseSensitive: true, value: '15085844419' }],
      ['pagePath', { matchType: 'EXACT', caseSensitive: true, value: '/' }],
      ['eventName', { matchType: 'EXACT', caseSensitive: true, value: 'landing_view' }],
    ])
    expect(result?.landingJourneys?.scope).toEqual(FIXFLAGS_LANDING_SCOPE)
  })

  it('leaves the FixFlags cohort untouched when pulling another property', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', 'other-property')
    report.mockResolvedValue({ data: { rows: [] } })
    expect((await runGaPull())?.landingJourneys).toBeNull()
    expect(report).toHaveBeenCalledTimes(4)
    expect(report.mock.calls.some(([request]) =>
      request.requestBody.dimensions.some(({ name }: { name: string }) => name === 'customEvent:journey_id'))).toBe(false)
    expect(transaction).not.toHaveBeenCalled()
    expect(persist.mock.calls.some(([kind]) => kind === 'ga-landing-journeys')).toBe(false)
  })

  it('persists and returns counts without retaining the provider or receipt keys', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'))
    const journeyId = `ffj_${'f'.repeat(32)}`
    try {
      report.mockImplementation(async ({ requestBody }) => ({ data: { metadata: { timeZone: 'UTC' },
        rows: requestBody.dimensions[0]?.name === 'customEvent:journey_id'
          ? [{ dimensionValues: [{ value: journeyId }], metricValues: [{ value: '1' }] }] : [],
      } }))
      const createdAt = new Date('2026-10-03T00:00:00Z')
      events.mockResolvedValueOnce([{ idempotencyKey: 'analyze_started:private-audit', createdAt,
        properties: { anonymous: true, journeyId } }])
        .mockResolvedValueOnce([{ idempotencyKey: 'analysis_completed:private-audit', createdAt }])
      audits.mockResolvedValue([{ id: 'private-audit', createdAt, userId: null, projectId: null, project: null,
        source: 'HOMEPAGE', status: 'COMPLETED', utmSource: null }])
      const result = await runGaPull()
      expect(result?.landingJourneys).toMatchObject({ version: 4, landingSessions: 1, startedSessions: 1,
        completedAnalysisSessions: 1, claimedSessions: 0, followupComplete: true })
      expect(JSON.stringify(result)).not.toMatch(/ffj_|private-audit|journeyIds/)
      expect(JSON.stringify(persist.mock.calls)).not.toMatch(/ffj_|private-audit|journeyIds/)
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' })
      expect(readOnly.mock.calls[0][0].join('')).toBe('SET TRANSACTION READ ONLY')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the other reports available when the landing join exceeds its read limit', async () => {
    const journeyId = `ffj_${'b'.repeat(32)}`
    report.mockImplementation(async ({ requestBody }) => ({ data: { metadata: { timeZone: 'UTC' },
      rows: requestBody.dimensions[0]?.name === 'customEvent:journey_id'
        ? [{ dimensionValues: [{ value: journeyId }], metricValues: [{ value: '1' }] }] : [],
    } }))
    events.mockResolvedValueOnce(Array(10_001).fill({}))
    const result = await runGaPull()
    expect(result?.landingJourneys).toMatchObject({ status: 'unavailable', landingSessions: null, startRate: null })
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ take: 10_001 }))
    expect(audits).not.toHaveBeenCalled()
    expect(persist).toHaveBeenCalledWith('ga-summary', 'ga/rolling-28d/summary', result?.summary)
  })

  it('requests exactly the declared number of inclusive calendar dates', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'))
    try {
      report.mockResolvedValue({ data: { rows: [] } })
      const result = await runGaPull({ days: 1 })
      expect(report.mock.calls[0][0].requestBody.dateRanges).toEqual([{ startDate: '2026-10-13', endDate: '2026-10-13' }])
      expect(result?.summary).toMatchObject({ startDate: '2026-10-13', endDate: '2026-10-13' })
      expect(report.mock.calls[1][0].requestBody.dateRanges).toEqual([{ startDate: '2026-10-04', endDate: '2026-10-04' }])
      expect(result?.landingJourneys).toMatchObject({ startDate: '2026-10-04', endDate: '2026-10-04' })
      expect(report.mock.calls[2][0].requestBody.dateRanges).toEqual([{ startDate: '2026-10-13', endDate: '2026-10-13' }])
    } finally {
      vi.useRealTimers()
    }
  })
})
