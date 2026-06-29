import { describe, it, expect } from 'vitest'
import { runMeasurementChecks } from '../checks/measurement'
import { healthyMeta } from './check-fixtures'

function checkIds(flags: ReturnType<typeof runMeasurementChecks>): string[] {
  return flags.map((f) => f.checkId)
}

describe('runMeasurementChecks', () => {
  it('flags a page with no analytics tag', () => {
    const flags = runMeasurementChecks(healthyMeta({ hasAnalytics: false }))
    expect(checkIds(flags)).toContain('measurement-ga-gtm-posthog-missing')
    const flag = flags[0]
    expect(flag.rubric).toBe('REACH')
    expect(flag.impactTag).toBe('MEASUREMENT')
    expect(flag.severity).toBe('IMPORTANT')
  })

  it('does not flag a page that already loads analytics', () => {
    const flags = runMeasurementChecks(healthyMeta({ hasAnalytics: true }))
    expect(checkIds(flags)).not.toContain('measurement-ga-gtm-posthog-missing')
  })
})
