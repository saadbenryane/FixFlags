import { describe, expect, it } from 'vitest'
import { runSlowReplayChecks } from '@/lib/audit/checks/slow-replay'

describe('slow connection CTA check', () => {
  it('flags a primary action that appears after 8 seconds', () => {
    const ids = runSlowReplayChecks({
      timeToFirstTextMs: 1000,
      timeToCtaMs: 9000,
      screenshotUrls: [],
    }).map((flag) => flag.checkId)
    expect(ids).toContain('slow-3g-cta-delayed')
  })

  it('does not call a missing action slow', () => {
    const ids = runSlowReplayChecks({
      timeToFirstTextMs: 1000,
      timeToCtaMs: 30_000,
      screenshotUrls: [],
    }).map((flag) => flag.checkId)
    expect(ids).not.toContain('slow-3g-cta-delayed')
  })
})
