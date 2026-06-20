import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { runDesignLanguageChecks } from '@/lib/audit/checks/design-language'

describe('runDesignLanguageChecks', () => {
  it('flags too many font families', () => {
    const flags = runDesignLanguageChecks({
      mobilePrimaryCtaTopPx: 100,
      mobilePrimaryCtaText: 'Start',
      mobileViewportHeight: 812,
      stuckLoadingIndicator: false,
      stuckLoadingLabel: null,
      uniqueFontFamilies: 5,
      fontFamilySample: ['Inter', 'Roboto', 'Georgia', 'Arial', 'Helvetica'],
      buttonBorderRadii: [8],
      motionIgnoresReducedPreference: false,
      motionSampleLabel: null,
      inputsBelow16px: [],
    })
    assert.equal(flags.length, 1)
    assert.equal(flags[0].checkId, 'font-family-sprawl')
  })

  it('flags inconsistent button radii', () => {
    const flags = runDesignLanguageChecks({
      mobilePrimaryCtaTopPx: 100,
      mobilePrimaryCtaText: 'Start',
      mobileViewportHeight: 812,
      stuckLoadingIndicator: false,
      stuckLoadingLabel: null,
      uniqueFontFamilies: 2,
      fontFamilySample: ['Inter'],
      buttonBorderRadii: [0, 8, 24],
      motionIgnoresReducedPreference: false,
      motionSampleLabel: null,
      inputsBelow16px: [],
    })
    assert.equal(flags.length, 1)
    assert.equal(flags[0].checkId, 'button-radius-inconsistent')
  })

  it('passes when typography and buttons are consistent', () => {
    assert.equal(
      runDesignLanguageChecks({
        mobilePrimaryCtaTopPx: 100,
        mobilePrimaryCtaText: 'Start',
        mobileViewportHeight: 812,
        stuckLoadingIndicator: false,
        stuckLoadingLabel: null,
        uniqueFontFamilies: 3,
        fontFamilySample: ['Inter', 'Georgia'],
        buttonBorderRadii: [8, 8],
        motionIgnoresReducedPreference: false,
        motionSampleLabel: null,
        inputsBelow16px: [],
      }).length,
      0
    )
  })
})
