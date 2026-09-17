import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  BRAND_HEX,
  brandDark,
  brandLight,
  contrastRatio,
} from '@/lib/design/brand-spec'

const AA_LARGE_TEXT = 3

describe('brand CTA contrast', () => {
  it('uses white labels on brand orange in both themes', () => {
    assert.equal(brandLight.brandForeground, BRAND_HEX.background)
    assert.equal(brandDark.brandForeground, BRAND_HEX.background)
  })

  it('meets large-text AA for brand fill against white labels in light theme', () => {
    const ratio = contrastRatio(brandLight.brandForeground, brandLight.brand)
    assert.ok(
      ratio >= AA_LARGE_TEXT,
      `light brand/foreground contrast ${ratio.toFixed(2)}:1 is below ${AA_LARGE_TEXT}:1`,
    )
  })

  it('meets large-text AA for brand fill against white labels in dark theme', () => {
    const ratio = contrastRatio(brandDark.brandForeground, brandDark.brand)
    assert.ok(
      ratio >= AA_LARGE_TEXT,
      `dark brand/foreground contrast ${ratio.toFixed(2)}:1 is below ${AA_LARGE_TEXT}:1`,
    )
  })
})
