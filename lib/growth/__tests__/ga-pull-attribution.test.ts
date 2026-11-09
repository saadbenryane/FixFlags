import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildGaLandingJourneyArtifact, runGaPull } from '@/lib/growth/ga-pull'

const { report, persist } = vi.hoisted(() => ({ report: vi.fn(), persist: vi.fn() }))
vi.mock('googleapis', () => ({ google: { analyticsdata: () => ({ properties: { runReport: report } }) } }))
vi.mock('@/lib/growth/google-auth', () => ({ googleServiceAccount: async () => ({}) }))
vi.mock('@/lib/growth/artifacts', () => ({ persistGrowthArtifact: persist }))
vi.mock('@/lib/analytics/site-first-value-funnel', () => ({ captureLandingJourneySnapshot: async () => null }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('GA landing journey export', () => {
  const metadata = {
    fetchedAt: '2026-10-03T12:00:00.000Z',
    startDate: '2026-09-05',
    endDate: '2026-10-03',
  }

  it('keeps only opaque journey keys and preserves their event volume', () => {
    const journeyId = `ffj_${'a'.repeat(32)}`
    expect(
      buildGaLandingJourneyArtifact(
        [{ 'customEvent:journey_id': journeyId, eventCount: 2 }],
        metadata,
      ),
    ).toEqual({
      ...metadata,
      reportingTimeZone: null,
      providerLimited: false,
      status: 'available',
      journeys: [{ journeyId, eventCount: 2 }],
      unattributedEventCount: 0,
      rowLimitReached: false,
    })
  })

  it('marks high-cardinality or missing dimension rows as partial', () => {
    expect(
      buildGaLandingJourneyArtifact(
        [
          { 'customEvent:journey_id': '(other)', eventCount: 7 },
          { 'customEvent:journey_id': '(not set)', eventCount: 3 },
        ],
        metadata,
      ),
    ).toEqual({
      ...metadata,
      reportingTimeZone: null,
      providerLimited: false,
      status: 'partial',
      journeys: [],
      unattributedEventCount: 10,
      rowLimitReached: false,
    })
  })

  it('marks a saturated export partial instead of silently truncating it', () => {
    const journeyId = `ffj_${'b'.repeat(32)}`
    expect(
      buildGaLandingJourneyArtifact(
        [{ 'customEvent:journey_id': journeyId, eventCount: 1 }],
        metadata,
        1,
      ),
    ).toMatchObject({ status: 'partial', rowLimitReached: true })
  })

  it('preserves provider limitations even when every journey row has a valid key', () => {
    const artifact = buildGaLandingJourneyArtifact(
      [{ 'customEvent:journey_id': `ffj_${'a'.repeat(32)}`, eventCount: 1 }],
      { ...metadata, reportingTimeZone: 'Africa/Casablanca', providerLimited: true },
    )
    expect(artifact).toMatchObject({ status: 'partial', reportingTimeZone: 'Africa/Casablanca', providerLimited: true })
  })
})

describe('FixFlags page export privacy', () => {
  const publicPath = '/guides/website-online-but-not-working'
  const receivedPaths = [publicPath, '/sites/fixture-site', '/report/fixture-report',
    '/share/fixture-token', '/reset-password', '/guides/fixture-secret', '/pricing?token=fixture-secret']

  function mockPageReport() {
    report.mockImplementation(async ({ requestBody }) => ({ data: {
      rows: requestBody.dimensions[0]?.name === 'pagePath'
        ? receivedPaths.map(value => ({ dimensionValues: [{ value }], metricValues: [{ value: '1' }] })) : [],
    } }))
  }

  it('restricts the provider request and both returned and stored page rows to public paths', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '541892062')
    mockPageReport()
    const result = await runGaPull()

    const pages = report.mock.calls.find(([call]) => call.requestBody.dimensions[0]?.name === 'pagePath')?.[0]
    expect(pages).toMatchObject({ property: 'properties/541892062', requestBody: { dimensionFilter: { andGroup: { expressions: [
      { filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: 'fixflags.com' } } },
      { filter: { fieldName: 'streamId', stringFilter: { matchType: 'EXACT', value: '15085844419' } } },
      { filter: { fieldName: 'pagePath', inListFilter: { caseSensitive: true, values: expect.arrayContaining([publicPath, '/new']) } } },
    ] } } } })
    expect(result?.pages.pages).toEqual([{ pagePath: publicPath, screenPageViews: 1 }])
    expect(persist.mock.calls.find(([kind]) => kind === 'ga-pages')?.[2]).toEqual(result?.pages)
    expect(JSON.stringify(persist.mock.calls)).not.toMatch(/fixture-site|fixture-token|fixture-secret|fixture-report/)
  })

  it('keeps other configured properties on their existing page export', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', 'other-property')
    mockPageReport()
    const result = await runGaPull()
    expect(result?.pages.pages.map(row => row.pagePath)).toEqual(receivedPaths)
    const pages = report.mock.calls.find(([call]) => call.requestBody.dimensions[0]?.name === 'pagePath')?.[0]
    expect(pages?.requestBody.dimensionFilter).toBeUndefined()
  })
})
