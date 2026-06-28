import { describe, it, expect } from 'vitest'
import { runCtaFocusChecks } from '../checks/cta-focus'
import type { CaptureMetrics } from '../capture-metrics'

function metrics(overrides: Partial<CaptureMetrics> = {}): CaptureMetrics {
  return {
    mobilePrimaryCtaTopPx: 200,
    mobilePrimaryCtaText: 'Get started',
    competingPrimaryCtaCount: 1,
    competingPrimaryCtaLabels: ['Get started'],
    mobileViewportHeight: 812,
    stuckLoadingIndicator: false,
    stuckLoadingLabel: null,
    uniqueFontFamilies: 2,
    fontFamilySample: ['Inter'],
    buttonBorderRadii: [8],
    motionIgnoresReducedPreference: false,
    motionSampleLabel: null,
    inputsBelow16px: [],
    ...overrides,
  }
}

describe('runCtaFocusChecks', () => {
  it('flags three or more competing primary CTAs above the fold', () => {
    const flags = runCtaFocusChecks(
      metrics({
        competingPrimaryCtaCount: 3,
        competingPrimaryCtaLabels: ['Get started', 'Book a demo', 'Start free trial'],
      })
    )
    expect(flags.map((f) => f.checkId)).toContain('competing-ctas')
    expect(flags[0].rubric).toBe('MESSAGE')
    expect(flags[0].evidence).toContain('Book a demo')
  })

  it('passes a focused page with a single primary CTA', () => {
    expect(runCtaFocusChecks(metrics({ competingPrimaryCtaCount: 1 }))).toEqual([])
  })

  it('passes with two CTAs (primary + secondary is fine)', () => {
    expect(runCtaFocusChecks(metrics({ competingPrimaryCtaCount: 2 }))).toEqual([])
  })

  it('returns nothing when capture metrics are unavailable', () => {
    expect(runCtaFocusChecks(null)).toEqual([])
  })
})
