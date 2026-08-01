import { describe, expect, it } from 'vitest'
import {
  computeLetterboxLayout,
  mapHighlightToLetterbox,
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

  it('letterboxes a wide image inside a tall container', () => {
    const layout = computeLetterboxLayout(16 / 9, 9 / 16)
    expect(layout.scale).toBe(1)
    expect(layout.offsetY).toBeGreaterThan(0)
    expect(layout.offsetX).toBe(0)
  })

  it('maps capture coordinates into the letterboxed image area', () => {
    const layout = computeLetterboxLayout(1, 2)
    const mapped = mapHighlightToLetterbox(
      { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      layout,
    )
    expect(mapped.x).toBeCloseTo(0.1 * layout.scale + layout.offsetX)
    expect(mapped.y).toBeCloseTo(0.2 * layout.scale + layout.offsetY)
    expect(mapped.width).toBeCloseTo(0.3 * layout.scale)
  })
})
