import { describe, expect, it } from 'vitest'
import { SITE_CARD_AREAS } from '@/lib/sites/card-areas'
import { categoryAreaSchema } from '@/lib/sites/domain/execution-spec'
import { LEGACY_BROAD_REQUIRED_AREAS } from '@/lib/sites/assessment'

/**
 * One area taxonomy, several deliberate subsets. A subset that drifts outside
 * the taxonomy breaks every contract that reads it, so the relationship is
 * asserted here rather than left to review.
 */
describe('area taxonomy', () => {
  it('keeps every board area in one vocabulary', () => {
    expect(new Set(SITE_CARD_AREAS).size).toBe(SITE_CARD_AREAS.length)
    expect(SITE_CARD_AREAS).toContain('site')
  })

  it('keeps category checks inside the board areas, without the pages card or reachability', () => {
    for (const area of categoryAreaSchema.options) expect(SITE_CARD_AREAS).toContain(area)
    expect(categoryAreaSchema.safeParse('site').success).toBe(false)
    expect(categoryAreaSchema.safeParse('uptime').success).toBe(false)
  })

  it('keeps historical broad responsibilities inside the board areas', () => {
    for (const area of LEGACY_BROAD_REQUIRED_AREAS) expect(SITE_CARD_AREAS).toContain(area)
  })
})
