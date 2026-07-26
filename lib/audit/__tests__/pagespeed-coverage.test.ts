import { describe, expect, it } from 'vitest'
import { derivePageSpeedCoverage } from '@/lib/audit/pagespeed-coverage'

describe('derivePageSpeedCoverage', () => {
  it('reports complete only when every route has both observations', () => {
    expect(derivePageSpeedCoverage([
      { url: 'https://example.com/', performanceData: { desktop: {}, mobile: {} } },
      { url: 'https://example.com/pricing', performanceData: { desktop: {}, mobile: {} } },
    ])).toEqual({
      status: 'complete',
      observedRoutes: 2,
      totalRoutes: 2,
      missingRoutes: [],
    })
  })

  it('names missing route strategies while retaining available observations', () => {
    expect(derivePageSpeedCoverage([
      { url: 'https://example.com/', performanceData: { desktop: {}, mobile: {} } },
      { url: 'https://example.com/contact', performanceData: { desktop: null, mobile: {} } },
    ])).toMatchObject({
      status: 'partial',
      observedRoutes: 2,
      totalRoutes: 2,
      missingRoutes: [
        { url: 'https://example.com/contact', missing: ['desktop'] },
      ],
    })
  })

  it('uses unavailable only when no PageSpeed observation exists', () => {
    expect(derivePageSpeedCoverage([
      { url: 'https://example.com/', performanceData: { desktop: null, mobile: null } },
    ])).toMatchObject({
      status: 'unavailable',
      observedRoutes: 0,
    })
  })
})
