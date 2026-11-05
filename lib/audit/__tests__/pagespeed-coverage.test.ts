import { describe, expect, it } from 'vitest'
import { derivePageSpeedCoverage } from '@/lib/audit/pagespeed-coverage'
import { collectCruxEvidence } from '../crux'

const lab = { score: 90, lcp: 1200, cls: 0.01, fcp: 800, tbt: 30 }

describe('derivePageSpeedCoverage', () => {
  it('does not turn empty provider objects into observed or complete measurements', () => {
    expect(derivePageSpeedCoverage([{ url: 'https://example.com/', performanceData: { desktop: {}, mobile: {} } }]))
      .toMatchObject({ status: 'unavailable', observedRoutes: 0, missingRoutes: [{ url: 'https://example.com/', missing: ['desktop', 'mobile'] }] })
  })
  it('reports complete only when every route has both observations', () => {
    expect(derivePageSpeedCoverage([
      { url: 'https://example.com/', performanceData: { desktop: lab, mobile: lab } },
      { url: 'https://example.com/pricing', performanceData: { desktop: lab, mobile: lab } },
    ])).toEqual({
      status: 'complete',
      observedRoutes: 2,
      totalRoutes: 2,
      missingRoutes: [],
    })
  })

  it('names missing route strategies while retaining available observations', () => {
    expect(derivePageSpeedCoverage([
      { url: 'https://example.com/', performanceData: { desktop: lab, mobile: lab } },
      { url: 'https://example.com/contact', performanceData: { desktop: null, mobile: lab } },
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

  it('keeps field-only and partial lab data observed without claiming complete lab coverage', () => {
    expect(derivePageSpeedCoverage([{ url: 'https://example.com/', performanceData: {
      desktop: { ...lab, lcp: null }, mobile: { strategy: 'mobile', score: null, inp: 900 },
    } }])).toEqual({ status: 'partial', observedRoutes: 1, totalRoutes: 1,
      missingRoutes: [{ url: 'https://example.com/', missing: ['desktop', 'mobile'] }] })
  })
  it('retains other field metrics when INP and all lab values are unavailable', () => {
    const url = 'https://example.com/'
    const crux = collectCruxEvidence({ loadingExperience: { id: url, metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4000 } } } }, url)
    expect(derivePageSpeedCoverage([{ url, performanceData: { mobile: { strategy: 'mobile', inp: null, crux } } }]))
      .toMatchObject({ status: 'partial', observedRoutes: 1, missingRoutes: [{ url, missing: ['desktop', 'mobile'] }] })
  })

  it.each([NaN, Infinity, -1, '90', null])('refuses invalid score %s as complete coverage while preserving valid metrics', score => {
    expect(derivePageSpeedCoverage([{ url: 'https://example.com/', performanceData: {
      desktop: { ...lab, score }, mobile: lab,
    } }])).toMatchObject({ status: 'partial', missingRoutes: [{ url: 'https://example.com/', missing: ['desktop'] }] })
  })
})
