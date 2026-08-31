import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  brandDark,
  brandLight,
  contrastRatio,
} from '@/lib/design/brand-spec'

const AA_NORMAL_TEXT = 4.5

describe('brand CTA contrast', () => {
  it('meets WCAG AA for brand fill against brand foreground in light theme', () => {
    const ratio = contrastRatio(brandLight.brandForeground, brandLight.brand)
    assert.ok(
      ratio >= AA_NORMAL_TEXT,
      `light brand/foreground contrast ${ratio.toFixed(2)}:1 is below ${AA_NORMAL_TEXT}:1`,
    )
  })

  it('meets WCAG AA for brand fill against brand foreground in dark theme', () => {
    const ratio = contrastRatio(brandDark.brandForeground, brandDark.brand)
    assert.ok(
      ratio >= AA_NORMAL_TEXT,
      `dark brand/foreground contrast ${ratio.toFixed(2)}:1 is below ${AA_NORMAL_TEXT}:1`,
    )
  })
})
