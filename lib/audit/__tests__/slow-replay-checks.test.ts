import { describe, expect, it } from 'vitest'
import { runSlowReplayChecks, slowReplayAssertions } from '@/lib/audit/checks/slow-replay'
import { SLOW_REPLAY_PROFILE, SLOW_REPLAY_VERIFICATION_RULE } from '@/lib/audit/flow/slow-replay-contract'
import { scopedAssertionForTarget } from '@/lib/audit/checks/verification'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'
import { collapseRecordedFixtureFlags as collapseFlagsWithAffectedPaths } from '@/lib/audit/__tests__/recorded-flag-fixtures'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'

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
    scope: { pageUrl: 'https://example.com/', finalUrl: 'https://example.com/', profile: 'mobile-native-fixture', access: 'public' },
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

  it.each([{ access: 'credentialed:other' }, { access: 'credentialed:unknown' }, { profile: 'different-browser-policy' },
    { finalUrl: 'https://example.com/sign-in' }, { pageUrl: 'https://example.com/#other-route' }])('keeps content and action repair unknown under changed native conditions %o', scope => {
    const identity = { selector: '#original', label: 'Get started', context: JSON.stringify({ profile: SLOW_REPLAY_PROFILE,
      pageUrl: measured.scope.pageUrl, href: 'https://example.com/start' }) }
    const failed = { ...measured, actions: [{ ...identity, timeToVisibleMs: 9000, absentThroughMs: 8900 }] }
    const flags = runSlowReplayChecks(failed)
    const changed = { ...failed, scope: { ...measured.scope, ...scope }, timeToContentMs: 1000,
      actions: [{ ...identity, timeToVisibleMs: 1000, absentThroughMs: 0 }] }
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'slow-replay', pageUrl: measured.scope.pageUrl,
      passed: true, applicable: true, complete: true, assertions: slowReplayAssertions(changed),
      execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
    expect(flags).toHaveLength(2)
    for (const flag of flags) expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })).toBeUndefined()
  })

  it('requires every originally affected content page in the same completed Run', () => {
    const pages = ['https://example.com/', 'https://example.com/pricing']
    const sources = pages.map(pageUrl => ({ ...measured, scope: { ...measured.scope, pageUrl, finalUrl: pageUrl } }))
    const flag = collapseFlagsWithAffectedPaths(sources.flatMap(result => runSlowReplayChecks(result).map(flag => ({ ...flag, pageUrl: result.scope.pageUrl }))))[0]
    const receipts = sources.map((result, index) => checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'slow-replay', pageUrl: pages[index],
      passed: true, applicable: true, complete: true, assertions: slowReplayAssertions({ ...result, timeToContentMs: 1000 }),
      execution: { auditId: 'after', taskId: 'task-' + index, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } }))
    const compare = (additional = [receipts[1]]) => scopedAssertionForTarget({ receipt: receipts[0], receipts: additional, checkId: flag.checkId, flag })
    expect(compare([])).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: { ...receipts[0], assertions: slowReplayAssertions(sources[0]) },
      checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: false, complete: true })
    expect(compare()?.assertion.passed).toBe(true)
    expect(compare([{ ...receipts[1], execution: { ...receipts[1].execution!, auditId: 'another-run' } }])).toBeUndefined()
    expect(compare([{ ...receipts[1], assertions: slowReplayAssertions(sources[1]) }])?.assertion.passed).toBe(false)
    const input = { auditId: 'after', flag, executionSpec: { version: 1, targetUrl: pages[0], environment: 'production', scope: 'SITE',
      checks: { 'slow-3g-blank-screen': 1 }, outcomes: [], verificationTarget: null } }
    const rows = receipts.map(detail => ({ targetKey: 'module:slow-replay', status: 'COMPLETED', detail }))
    expect(hasRecordedRecoveryEvidence({ ...input, executions: rows })).toBe(true)
    expect(hasRecordedRecoveryEvidence({ ...input, executions: rows.slice(0, 1) })).toBe(false)
  })

  it('retains historical timing facts without inventing their missing capture conditions', () => {
    const { scope, ...historical } = measured
    void scope
    const legacy = runSlowReplayChecks(historical)[0]
    expect(legacy).toMatchObject({ checkId: 'slow-3g-blank-screen', verificationRule: 'Slow connection observation v1' })
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'slow-replay', pageUrl: measured.scope.pageUrl,
      passed: true, applicable: true, complete: true, assertions: slowReplayAssertions({ ...measured, timeToContentMs: 1000 }),
      execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
    expect(scopedAssertionForTarget({ receipt, checkId: legacy.checkId, flag: legacy })).toBeUndefined()
    const input = { auditId: 'after', flag: { checkId: legacy.checkId, pageUrl: measured.scope.pageUrl }, executionSpec: {
      version: 1, targetUrl: measured.scope.pageUrl, environment: 'production', scope: 'SITE',
      checks: { 'slow-3g-blank-screen': 1 }, outcomes: [], verificationTarget: null } }
    expect(hasRecordedRecoveryEvidence({ ...input, executions: [{ targetKey: 'check:' + legacy.checkId, status: 'COMPLETED', detail: {
      kind: 'check-verifier', version: 1, auditId: 'after', taskId: 'historical-task', checkId: legacy.checkId, checkVersion: 1,
      pageUrl: measured.scope.pageUrl, source: 'rendered-dom', collectedAt: new Date().toISOString(), comparable: true,
      verdict: 'passed', assertion: receipt.assertions[0],
    } }] })).toBe(false)
  })
})
