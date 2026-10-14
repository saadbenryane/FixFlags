import { describe, expect, it } from 'vitest'
import { evaluateCorridorConsistency, runCorridorConsistencyChecks, type CorridorPageMeta } from '@/lib/audit/checks/corridor-consistency'
import { collapseFlagsWithAffectedPaths } from '@/lib/audit/flag-identity'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'
import { scopedAssertionForTarget } from '@/lib/audit/checks/verification'
import { hasRecordedRecoveryEvidence } from '@/lib/audit/recovery-evidence'
import { projectCheckResults } from '@/lib/sites/check-results'
import { buildCoverageFacts } from '@/lib/sites/coverage'

describe('runCorridorConsistencyChecks', () => {
  it('flags identical og titles across corridor pages', () => {
    const flags = runCorridorConsistencyChecks([
      {
        url: 'https://example.com/',
        role: 'primary',
        ogTitle: 'Same Title',
        ogDescription: 'A',
        title: 'Same Title',
      },
      {
        url: 'https://example.com/pricing',
        role: 'pricing',
        ogTitle: 'Same Title',
        ogDescription: 'B',
        title: 'Same Title',
      },
    ])
    expect(flags.some((f) => f.checkId === 'corridor-og-title-drift')).toBe(true)
  })

  it('passes when titles differ', () => {
    const flags = runCorridorConsistencyChecks([
      {
        url: 'https://example.com/',
        role: 'primary',
        ogTitle: 'Home',
        ogDescription: 'Home desc that is long enough',
        title: 'Home',
      },
      {
        url: 'https://example.com/pricing',
        role: 'pricing',
        ogTitle: 'Pricing',
        ogDescription: 'Pricing desc that is long enough',
        title: 'Pricing',
      },
    ])
    expect(flags).toHaveLength(0)
  })

  function pages(): CorridorPageMeta[] {
    return ['/', '/pricing', '/features'].map((path, index) => {
      const url = 'https://example.com' + path
      return { url, role: index ? 'linked' : 'primary', title: 'Same title', ogTitle: 'Same title',
        ogDescription: 'The same long description for every page.', scope: { pageUrl: url, finalUrl: url, profile: 'desktop-fixture', access: 'public' } }
    })
  }
  function receipts(input: CorridorPageMeta[]) {
    return [...evaluateCorridorConsistency(input).assertions].map(([pageUrl, assertions]) => checkReceiptSchema.parse({
      kind: 'site-module-check', version: 1, module: 'corridor', pageUrl, assertions, applicable: true,
      passed: assertions.every(assertion => assertion.complete && (assertion.disposition === 'observed' || assertion.passed)), complete: assertions.every(assertion => assertion.complete),
      execution: { auditId: 'after', taskId: 'cross-page', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
    }))
  }
  it('records inspected optional absence without declaring a comparison passed or blocking other Conversion evidence', () => {
    const inspected = pages().map((page, index) => ({ ...page, ogTitle: null, ogDescription: null, title: 'Page ' + index }))
    const observations = evaluateCorridorConsistency(inspected)
    expect(observations.flags).toEqual([])
    expect([...observations.assertions.values()].flat().filter(item => item.key === 'preview-descriptions'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ complete: true, disposition: 'observed', passed: false })]))
    const source = receipts(inspected)
    const results = projectCheckResults('after', source.map((detail, index) => ({ id: 'receipt-' + index,
      targetKey: 'module:corridor', status: 'COMPLETED', pageUrl: detail.pageUrl, updatedAt: new Date(), detail })))
    expect(results.filter(item => item.assertionKey === 'preview-descriptions').every(item => item.status === 'observed')).toBe(true)
    expect(results.some(item => item.status === 'unknown')).toBe(false)
    expect(buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: new Date(), now: new Date(), flags: [], evidenceCoverage: { flowScan: true },
      verifierExecutions: source.map(detail => ({ targetKey: 'module:corridor', status: 'COMPLETED', detail })) }).find(item => item.area === 'conversion')?.state).toBe('healthy')
    const prior = collapseFlagsWithAffectedPaths(runCorridorConsistencyChecks(pages())).find(flag => flag.checkId === 'corridor-og-description-drift')!
    expect(scopedAssertionForTarget({ receipt: source[0], receipts: source, checkId: prior.checkId, flag: prior })).toBeUndefined()
    const unavailable = receipts(inspected.map(page => ({ ...page, scope: undefined })))
    expect(unavailable.every(receipt => !receipt.complete)).toBe(true)
  })
  it('collects both preview responsibilities and all original page pairs', () => {
    const found = runCorridorConsistencyChecks(pages())
    expect(found.map(flag => flag.checkId)).toEqual(['corridor-og-title-drift', 'corridor-og-description-drift', 'corridor-og-title-drift', 'corridor-og-description-drift'])
    const collapsed = collapseFlagsWithAffectedPaths(found)
    expect(collapsed).toHaveLength(2)
    expect(collapsed.every(flag => flag.affectedPaths.length === 3 && flag.evidenceTargets?.length === 2)).toBe(true)
  })
  it('requires every original pair for repair, including when the diagnostic begins on a peer page', () => {
    const original = pages(), flag = collapseFlagsWithAffectedPaths(runCorridorConsistencyChecks(original))[0]
    const repaired = original.map((page, index) => ({ ...page, role: index === 1 ? 'primary' : 'linked', ogTitle: 'Page ' + index,
      ogDescription: 'Description for page ' + index }))
    const source = receipts(repaired)
    expect(scopedAssertionForTarget({ receipt: source[0], receipts: source, checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
      targetUrl: original[0].url, environment: 'production', checks: { [flag.checkId]: 1 }, outcomes: [], verificationTarget: null },
      flag, executions: source.map(detail => ({ targetKey: 'module:corridor', status: 'COMPLETED', detail })) })).toBe(true)
    for (const input of [repaired.slice(0, 2), repaired.map((page, index) => index === 2 ? { ...page, ogTitle: repaired[0].ogTitle } : page),
      repaired.map((page, index) => index === 2 ? { ...page, scope: { ...page.scope!, access: 'other-access' } } : page),
      repaired.map((page, index) => index === 2 ? { ...page, scope: { ...page.scope!, finalUrl: page.url + '/changed' } } : page),
      repaired.map((page, index) => index === 2 ? { ...page, ogTitle: null, title: null } : page)]) {
      const current = receipts(input)
      expect(scopedAssertionForTarget({ receipt: current[0], receipts: current, checkId: flag.checkId, flag })?.assertion.passed).not.toBe(true)
    }
    expect(scopedAssertionForTarget({ receipt: source[0], receipts: source, checkId: flag.checkId, flag: {} })).toBeUndefined()
  })
})
