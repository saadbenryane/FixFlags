import { describe, expect, it } from 'vitest'
import { ANALYZE_CTA, CORE_LOOP_LABEL, SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { FLAG_STATUS_LABELS } from '@/lib/marketing/copy/flags'
import { plannedWatchJobs } from '@/lib/audit/project-watch'

describe('Flag. Fix. Verify. loop contract', () => {
  it('locks Analyze, the core loop, Send a Flag to your AI, and independent Verify', () => {
    expect(ANALYZE_CTA).toBe('Analyze')
    expect(CORE_LOOP_LABEL).toBe('Flag. Fix. Verify.')
    expect(SITE_BOARD_COPY.sendFlagToAi).toBe('Send a Flag to your AI')
    expect(SITE_BOARD_COPY.verifyFix).toBe('Verify fix')
    expect(FLAG_STATUS_LABELS.FIXED.label).toBe('Verified')
    expect(FLAG_STATUS_LABELS.FIXED.description).toMatch(/Independent check/)
    expect(FLAG_STATUS_LABELS.FIXED.description).not.toMatch(/no longer observes|not observed/i)
  })

  it('keeps pulse unscheduled until costed, with full walks on the existing interval', () => {
    expect(plannedWatchJobs('weekly')).toEqual({ pulse: null, full: 'weekly' })
    expect(plannedWatchJobs('daily')).toEqual({ pulse: null, full: 'daily' })
  })
})
