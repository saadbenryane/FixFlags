import { describe, expect, it } from 'vitest'
import {
  highlightCenter,
  normalizedPercent,
} from '@/lib/audit/highlight-geometry'

describe('highlight geometry', () => {
  it('calculates the center of normalized evidence bounds', () => {
    const center = highlightCenter({
      x: 0.1,
      y: 0.2,
      width: 0.4,
      height: 0.2,
    })
    expect(center.x).toBeCloseTo(0.3)
    expect(center.y).toBeCloseTo(0.3)
  })

  it('converts normalized coordinates to CSS percentages', () => {
    expect(normalizedPercent(0.375)).toBe('37.5%')
  })
})
