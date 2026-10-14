import { describe, expect, it } from 'vitest'
import { runSlowReplayChecks, slowReplayAssertions } from '@/lib/audit/checks/slow-replay'
import { SLOW_REPLAY_PROFILE, SLOW_REPLAY_VERIFICATION_RULE } from '@/lib/audit/flow/slow-replay-contract'
import { scopedAssertionForTarget } from '@/lib/audit/checks/verification'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'

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

  const measured = { profile: SLOW_REPLAY_PROFILE, navigationComplete: true, complete: true,
    timeToFirstTextMs: 30_000, timeToCtaMs: 30_000, observedForMs: 9900, textBlankThroughMs: 9900, ctaAbsentThroughMs: 9900, screenshotUrls: [] }
  it('reports its real absence window and keeps a missing action separate', () => {
    const flags = runSlowReplayChecks(measured)
    expect(flags.map(flag => flag.checkId)).toEqual(['slow-3g-blank-screen'])
    expect(flags[0].evidence).toContain('9900ms')
    expect(flags[0].evidence).not.toContain('30 seconds')
    expect(flags[0].verificationRule).toBe(SLOW_REPLAY_VERIFICATION_RULE)
    expect(slowReplayAssertions(measured)[1]).toMatchObject({ passed: true, complete: true, disposition: 'observed' })
  })
  it('retains a proven text failure while another responsibility has a sampling gap', () => {
    const result = { ...measured, complete: false, timeToCtaMs: 8100, ctaAbsentThroughMs: 7900 }
    expect(runSlowReplayChecks(result).map(flag => flag.checkId)).toEqual(['slow-3g-blank-screen'])
    expect(slowReplayAssertions(result)[1].complete).toBe(false)
    expect(runSlowReplayChecks({ ...result, timeToFirstTextMs: 5100, textBlankThroughMs: 4900 })).toEqual([])
  })
  it('accepts observed image content and refuses restricted or incomplete graphic evidence', () => {
    expect(runSlowReplayChecks({ ...measured, timeToContentMs: 1000, contentAbsentThroughMs: 900 })).toEqual([])
    expect(runSlowReplayChecks({ ...measured, timeToContentMs: 30_000, contentAbsentThroughMs: 0 })).toEqual([])
    const restricted = { ...measured, restricted: true }
    expect(runSlowReplayChecks(restricted)).toEqual([])
    expect(slowReplayAssertions(restricted).every(assertion => !assertion.complete && !assertion.passed)).toBe(true)
  })
  it('requires the same measured mobile profile and source rule for recovery', () => {
    const result = { ...measured, timeToFirstTextMs: 1000, timeToCtaMs: 2000, textBlankThroughMs: 900, ctaAbsentThroughMs: 1900 }
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'slow-replay',
      pageUrl: 'https://example.com/', passed: true, applicable: true, complete: true, assertions: slowReplayAssertions(result),
      execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
    const flag = runSlowReplayChecks(measured)[0]
    expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: true, complete: true })
    expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag: { ...flag, verificationRule: null } })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag: { ...flag, evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', context: SLOW_REPLAY_PROFILE }] } })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: { ...receipt, assertions: slowReplayAssertions(measured) }, checkId: 'slow-3g-cta-delayed', flag })).toBeUndefined()
  })
  it('refuses a passing competing action and accepts only the original action identity', () => {
    const identity = { selector: '#original', label: 'Get started', context: JSON.stringify({ profile: SLOW_REPLAY_PROFILE,
      pageUrl: 'https://example.com/', href: 'https://example.com/start' }) }
    const failed = { ...measured, actions: [{ ...identity, timeToVisibleMs: 9000, absentThroughMs: 8900 }] }
    const flag = runSlowReplayChecks(failed).find(item => item.checkId === 'slow-3g-cta-delayed')!
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'slow-replay',
      pageUrl: 'https://example.com/', passed: true, applicable: true, complete: true,
      execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
      assertions: slowReplayAssertions({ ...failed, actions: [{ ...identity, selector: '#other', label: 'Contact', timeToVisibleMs: 1000, absentThroughMs: 0 }] }),
    })
    expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })).toBeUndefined()
    receipt.assertions = slowReplayAssertions({ ...failed, actions: [{ ...identity, selector: '#renamed', timeToVisibleMs: 1000, absentThroughMs: 0 }] })
    expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: true })
    expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })?.assertion.targets).toEqual([expect.objectContaining({ selector: '#renamed' })])
  })
})
