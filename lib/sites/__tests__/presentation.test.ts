import { describe, expect, it } from 'vitest'
import {
  categoryPresentation,
  categoryReadsCurrentClear,
  customerAttention,
  flagPriority,
  freshnessLabel,
  monitoringPresentation,
  pageCoverageLabel,
  pagesCardPresentation,
  resultPresentation,
  runBanner,
  runPresentation,
  siteSortRank,
  verificationResult,
  type SitePresentation,
} from '../presentation'

describe('Site presentation', () => {
  it('keeps result, monitoring, coverage, and freshness independent', () => {
    expect(resultPresentation({ auditStatus: 'COMPLETED', healthState: 'problem', flagCount: 4, stale: false, hasCurrentEvidence: true })).toEqual({ state: 'flags', label: 'Flags found' })
    expect(monitoringPresentation('off', null)).toEqual({ state: 'not_monitored', label: 'Not monitored' })
    expect(pageCoverageLabel(21, 24)).toBe('21 of 24 pages')
    expect(freshnessLabel('2026-10-08T10:00:00.000Z', new Date('2026-10-08T10:08:00.000Z'))).toBe('Checked 8 min ago')
  })

  it('never presents missing, stale, or failed evidence as clear', () => {
    expect(resultPresentation({ auditStatus: 'COMPLETED', healthState: 'unknown', flagCount: 0, stale: false, hasCurrentEvidence: false }).state).toBe('could_not_verify')
    expect(resultPresentation({ auditStatus: 'COMPLETED', healthState: 'healthy', flagCount: 0, stale: true, hasCurrentEvidence: false }).state).toBe('stale')
    expect(resultPresentation({ auditStatus: 'FAILED', healthState: 'healthy', flagCount: 0, stale: false, hasCurrentEvidence: true }).state).toBe('failed')
  })

  it('ranks work, Fix-first Flags, evidence gaps, other Flags, then clear Sites', () => {
    const base = {
      identity: { siteId: 'site-1', name: 'Example', host: 'example.com', preview: null },
      result: { state: 'clear' as const, label: 'Clear' },
      monitoring: { state: 'weekly' as const, label: 'Weekly' },
      coverage: { pagesReached: 1, pagesExpected: 1, label: '1 page', complete: true },
      freshness: { checkedAt: '2026-10-08T10:00:00.000Z', stale: false, label: 'Checked just now' },
      flags: { count: 0, label: '0 Flags', fixFirstCount: 0 },
      run: { state: 'idle' as const, label: 'Run details', auditId: 'audit-1', recoveryAction: null },
      categories: [],
    }
    expect(siteSortRank({ ...base, result: { state: 'failed', label: 'Analysis incomplete' } })).toBe(0)
    expect(siteSortRank({ ...base, flags: { count: 1, label: '1 Flag', fixFirstCount: 1 } })).toBe(1)
    expect(siteSortRank({ ...base, result: { state: 'stale', label: 'Out of date' } })).toBe(2)
    expect(siteSortRank({ ...base, result: { state: 'flags', label: 'Flags found' }, flags: { count: 1, label: '1 Flag', fixFirstCount: 0 } })).toBe(3)
    expect(siteSortRank(base)).toBe(4)
  })

  it('names every run and never turns incomplete evidence into a clear zero', () => {
    expect(runPresentation({ auditId: null, auditStatus: null, startedAt: null, failureCode: null }).state).toBe('idle')
    expect(runPresentation({ auditId: 'a', auditStatus: 'QUEUED', startedAt: null, failureCode: null })).toMatchObject({ state: 'queued', recoveryAction: 'view_details' })
    expect(runPresentation({ auditId: 'a', auditStatus: 'CHECKING', startedAt: new Date(), failureCode: null }).state).toBe('running')
    expect(runPresentation({ auditId: 'a', auditStatus: 'COMPLETED', startedAt: new Date(), failureCode: 'AI_CONTRACT_INVALID' })).toMatchObject({ state: 'partial', recoveryAction: 'retry' })
    expect(runPresentation({ auditId: 'a', auditStatus: 'FAILED', startedAt: null, failureCode: 'LOST' }).state).toBe('failed')
    expect(runPresentation({ auditId: 'a', auditStatus: 'FAILED', startedAt: new Date(), failureCode: 'LOST' }).state).toBe('interrupted')

    const states = ['healthy', 'unknown', 'problem', 'attention', 'checking'] as const
    for (const auditStatus of ['COMPLETED', 'FAILED', 'CHECKING', null] as const) {
      for (const stale of [false, true]) {
        for (const hasCurrentEvidence of [false, true]) {
          for (const flagCount of [0, 2]) {
            for (const healthState of states) {
              const result = resultPresentation({ auditStatus, healthState, flagCount, stale, hasCurrentEvidence })
              const clear = flagCount === 0
                && !stale
                && hasCurrentEvidence
                && healthState !== 'unknown'
                && (auditStatus === null || auditStatus === 'COMPLETED')
              expect(result.state === 'clear').toBe(clear)
              if (result.state === 'clear') expect(result.label).not.toBe('0 Flags')
            }
          }
        }
      }
    }
  })

  it('shows a Flag count only for Flags or a current clear result', () => {
    const flags = { count: 0, label: '0 Flags', fixFirstCount: 0 }
    expect(customerAttention({ result: { state: 'clear', label: 'Clear' }, flags })).toEqual({ text: '0 Flags', tone: 'clear' })
    expect(customerAttention({ result: { state: 'stale', label: 'Out of date' }, flags }).text).toBe('Out of date')
    expect(customerAttention({ result: { state: 'failed', label: 'Analysis incomplete' }, flags }).text).toBe('Analysis incomplete')
    expect(customerAttention({ result: { state: 'checking', label: 'Analyzing' }, flags }).text).toBe('Analyzing')
    expect(customerAttention({ result: { state: 'could_not_verify', label: 'Couldn’t verify' }, flags }).tone).toBe('pending')
    expect(customerAttention({ result: { state: 'flags', label: 'Flags found' }, flags: { count: 3, label: '3 Flags', fixFirstCount: 1 } })).toEqual({ text: '3 Flags', tone: 'attention' })
  })

  it('uses one banner for active, incomplete, and paused work', () => {
    const monitoring = { state: 'weekly' as const, label: 'Weekly' }
    const run = { state: 'idle' as const, label: 'Run details', auditId: 'audit-1', recoveryAction: null }
    expect(runBanner({ run: { ...run, state: 'running', recoveryAction: 'view_details' }, monitoring })?.headline).toBe('Analyzing')
    expect(runBanner({ run: { ...run, state: 'partial', recoveryAction: 'retry' }, monitoring })?.headline).toBe('Analysis incomplete')
    expect(runBanner({ run: { ...run, state: 'running' }, monitoring, disconnected: true })?.headline).toBe('Updates disconnected')
    expect(runBanner({ run, monitoring: { state: 'paused', label: 'Paused' } })?.headline).toBe('Updates paused')
    expect(runBanner({ run, monitoring })?.kind).toBe('details')
    expect(runBanner({ run: { ...run, auditId: null }, monitoring })).toBeNull()
  })

  it('keeps Pages from reading green when evidence is incomplete or stale', () => {
    const site = {
      identity: { siteId: 'site-1', name: 'Example', host: 'example.com', preview: null },
      result: { state: 'clear' as const, label: 'Clear' },
      monitoring: { state: 'weekly' as const, label: 'Weekly' },
      coverage: { pagesReached: 24, pagesExpected: 24, label: '24 pages', complete: true },
      freshness: { checkedAt: '2026-10-08T10:00:00.000Z', stale: false, label: 'Checked just now' },
      flags: { count: 0, label: '0 Flags', fixFirstCount: 0 },
      run: { state: 'idle' as const, label: 'Run details', auditId: 'audit-1', recoveryAction: null },
      categories: [],
    } satisfies SitePresentation
    expect(pagesCardPresentation(site).state).toBe('healthy')
    expect(pagesCardPresentation({ ...site, freshness: { ...site.freshness, stale: true } }).state).not.toBe('healthy')
    expect(pagesCardPresentation({ ...site, coverage: { ...site.coverage, complete: false } }).state).not.toBe('healthy')
    expect(pagesCardPresentation({ ...site, result: { state: 'failed', label: 'Analysis incomplete' } }).state).not.toBe('healthy')
    expect(pagesCardPresentation({ ...site, result: { state: 'checking', label: 'Analyzing' } }).state).not.toBe('healthy')
    const staleCategory = categoryPresentation({
      id: 'security', name: 'Security', state: 'unknown', answer: 'Out of date', status: 'Out of date',
      flagCount: 0, fixFirstCount: 0, checkedAt: null, coverageLimitation: 'Check out of date', siteId: 'site-1',
    })
    expect(categoryReadsCurrentClear(staleCategory, true)).toBe(false)
    expect(staleCategory.rank).toBe(2)
    const fixFirst = categoryPresentation({
      id: 'conversion', name: 'Conversion', state: 'problem', answer: '1 Flag', status: 'Needs a fix',
      flagCount: 1, fixFirstCount: 1, checkedAt: null, siteId: 'site-1',
    })
    expect(fixFirst.rank).toBe(0)
    expect(categoryReadsCurrentClear(fixFirst, false)).toBe(false)
  })

  it('distinguishes verification results without treating a copied prompt as recovery', () => {
    expect(verificationResult({ outcome: null, comparable: null, reason: null })).toBe('verifying')
    expect(verificationResult({ outcome: 'IMPROVED', comparable: true, reason: null })).toBe('verified')
    expect(verificationResult({ outcome: 'UNCHANGED', comparable: true, reason: null })).toBe('still_open')
    expect(verificationResult({ outcome: 'REGRESSED', comparable: true, reason: null })).toBe('regressed')
    expect(verificationResult({ outcome: 'INCONCLUSIVE', comparable: false, reason: 'The update Review did not capture comparable evidence.' })).toBe('missing_evidence')
    expect(verificationResult({ outcome: 'INCONCLUSIVE', comparable: false, reason: 'The update Review did not complete the affected page.' })).toBe('incomparable_scope')
    expect(verificationResult({ outcome: 'INCONCLUSIVE', comparable: true, reason: 'The check finished without a decision.' })).toBe('could_not_verify')
  })

  it('uses impact, confidence, scope, and Outcome relevance for customer priority', () => {
    expect(flagPriority({ severity: 'CRITICAL', confidence: 0.9, affectedPageCount: 1 }).band).toBe('fix_first')
    expect(flagPriority({ severity: 'IMPORTANT', confidence: 0.9, affectedPageCount: 3, outcomeId: 'checkout' }).band).toBe('fix_first')
    expect(flagPriority({ severity: 'IMPORTANT', confidence: 0.2, affectedPageCount: 1 }).band).toBe('other')
  })
})
