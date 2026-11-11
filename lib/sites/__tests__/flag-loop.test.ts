import { describe, expect, it } from 'vitest'
import { ANALYZE_CTA, SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { PRODUCT_STORY } from '@/lib/marketing/copy/product-story'
import { FLAG_STATUS_LABELS } from '@/lib/marketing/copy/flags'
import { plannedWatchJobs } from '@/lib/audit/project-watch'

describe('Check, Flag, Fix, Verify loop contract', () => {
  it('locks the website check action, the core loop, Copy fix instructions, and independent Verify', () => {
    expect(ANALYZE_CTA).toBe('Check your website')
    expect(PRODUCT_STORY.loop).toEqual(['Check', 'Flag', 'Fix', 'Verify'])
    expect(SITE_BOARD_COPY.sendFlagToAi).toBe('Copy fix instructions')
    expect(SITE_BOARD_COPY.verifyFix).toBe('Recheck')
    expect(FLAG_STATUS_LABELS.FIXED.label).toBe('Verified')
    expect(FLAG_STATUS_LABELS.FIXED.description).toMatch(/Independent check/)
    expect(FLAG_STATUS_LABELS.FIXED.description).not.toMatch(/no longer observes|not observed/i)
  })

  it('keeps pulse unscheduled until costed, with full walks on the existing interval', () => {
    expect(plannedWatchJobs('weekly')).toEqual({ pulse: null, full: 'weekly' })
    expect(plannedWatchJobs('daily')).toEqual({ pulse: null, full: 'daily' })
  })
})
