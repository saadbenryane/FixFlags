import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { query, persist } = vi.hoisted(() => ({ query: vi.fn(), persist: vi.fn() }))
vi.mock('googleapis', () => ({ google: { searchconsole: () => ({ searchanalytics: { query } }) } }))
vi.mock('../google-auth', () => ({ googleServiceAccount: async () => ({}) }))
vi.mock('../artifacts', () => ({ persistGrowthArtifact: persist }))
import { runGscPull } from '../gsc-pull'

describe('Search Console metric definitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GSC_PROPERTY', 'sc-domain:fixflags.com')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'))
    query.mockImplementation(async ({ requestBody }) => {
      const dimensions = requestBody.dimensions.join(',')
      const rows = dimensions === '' ? [{ keys: [], clicks: 10, impressions: 100, ctr: 0.1, position: 3 }] :
        dimensions === 'query' ? [{ keys: ['fixflags'], clicks: 4, impressions: 40, ctr: 0.1, position: 1 }] :
        dimensions === 'page' ? [{ keys: ['https://fixflags.com/'], clicks: 10, impressions: 100, ctr: 0.1, position: 3 }] : []
      return { data: { rows } }
    })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

  it('uses property totals instead of treating visible query rows as complete traffic', async () => {
    const result = await runGscPull()
    expect(result?.summary).toMatchObject({
      totalClicks: 10, totalImpressions: 100, avgCtr: 0.1, avgPosition: 3,
      returnedQueryClicks: 4, returnedQueryImpressions: 40, queryClickCoverage: 0.4,
      brandedClicks: 4, brandedShare: 0.4, indexedPages: null, pagesWithSearchImpressions: 1,
      startDate: '2026-09-16', endDate: '2026-10-13',
    })
    expect(query).toHaveBeenCalledTimes(4)
    expect(query.mock.calls.find(([args]) => args.requestBody.dimensions.length === 0)?.[0].requestBody)
      .toMatchObject({ aggregationType: 'byProperty', dataState: 'final', type: 'web' })
  })

  it('does not replace unavailable property totals with partial query counts', async () => {
    query.mockImplementation(async ({ requestBody }) => ({ data: { rows: requestBody.dimensions.join(',') === 'query'
      ? [{ keys: ['fixflags'], clicks: 4, impressions: 40, ctr: 0.1, position: 1 }] : [] } }))
    expect((await runGscPull())?.summary).toMatchObject({
      totalClicks: null, totalImpressions: null, avgCtr: null, avgPosition: null,
      returnedQueryClicks: 4, brandedClicks: 4, brandedShare: null, queryClickCoverage: null,
    })
  })

  it('requests one inclusive calendar date for a one-day window', async () => {
    await runGscPull({ days: 1 })
    expect(query.mock.calls[0][0].requestBody).toMatchObject({ startDate: '2026-10-13', endDate: '2026-10-13' })
  })
})
