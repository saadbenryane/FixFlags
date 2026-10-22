import { describe, expect, it } from 'vitest'
import { createRecordedRecoveryReader } from '../recovery-evidence'
import { observationsForFlag, mergeSupportingObservations } from '../flag-observations'
import { evaluateSearch, searchFindings } from '../search/registry'
import { searchReceiptSchema } from '../search/contracts'
import { document, evidence, PAGE } from '../search/__tests__/fixtures'
import { assessVerificationCoverage } from '@/lib/improvements/verification-coverage'

const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: PAGE,
  environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null }
function response(pageUrl = PAGE, passed = true, complete = true) {
  return { targetKey: 'module:security', status: 'COMPLETED', detail: {
    kind: 'site-module-check', version: 1, module: 'security', applicable: true, complete, passed, pageUrl,
    assertions: [{ key: 'https', name: 'HTTPS', expected: 'HTTPS', observed: passed ? 'HTTPS' : 'HTTP', passed, complete }],
    execution: { auditId: 'after', taskId: 'http:' + pageUrl, checkVersion: 1, source: 'http', collectedAt: '2026-10-20T12:00:00Z' },
  } }
}
const flag = (pageUrl = PAGE) => ({ checkId: 'no-https', pageUrl })
function original(pageUrl: string) {
  return observationsForFlag(flag(pageUrl), { auditId: 'before', taskId: 'source:' + pageUrl, checkVersion: 1 })
}

describe('prepared recovery uses one selected evidence snapshot', () => {
  it('keeps separate passed, failed, unavailable and original multi-page conclusions within one batch', () => {
    const peer = PAGE + 'other', unknown = PAGE + 'unknown'
    const reader = createRecordedRecoveryReader({ auditId: 'after', executionSpec: spec,
      executions: [response(), response(peer, false), response(unknown, false, false)] })
    expect([PAGE, peer, unknown, PAGE + 'missing'].map(page => reader.verdict(flag(page))))
      .toEqual(['passed', 'failed', null, null])
    expect(reader.hasRecovery(flag())).toBe(true)
    expect(reader.hasRecovery(flag(peer))).toBe(false)
    expect(reader.verdict({ ...flag(), supportingObservations: mergeSupportingObservations([original(PAGE), original(peer)]) })).toBe('failed')
    expect(reader.verdict({ ...flag(), supportingObservations: mergeSupportingObservations([original(PAGE), original(unknown)]) })).toBeNull()
  })

  it('does not read mutated transport input or a later admitted scope through a retained reader', () => {
    const receipt = response(), executionSpec = structuredClone(spec)
    const executions = [receipt]
    const reader = createRecordedRecoveryReader({ auditId: 'after', executionSpec, executions })
    receipt.detail.assertions[0].passed = false
    executionSpec.checks['no-https'] = 2
    expect(reader.verdict(flag())).toBe('passed')
    expect(createRecordedRecoveryReader({ auditId: 'after', executionSpec, executions }).verdict(flag())).toBeNull()
    executionSpec.checks['no-https'] = 1
    expect(createRecordedRecoveryReader({ auditId: 'after', executionSpec, executions }).verdict(flag())).toBe('failed')
    executions.length = 0
    expect(reader.verdict(flag())).toBe('passed')
    expect(createRecordedRecoveryReader({ auditId: 'after', executionSpec, executions }).verdict(flag())).toBeNull()
  })

  it('compares each original Search policy rather than caching a verdict for its shared check and page', async () => {
    const missing = '<html><head></head><body>Useful service</body></html>'
    const present = '<html><head><title>Useful service</title></head><body>Useful service</body></html>'
    const source = async (input: ReturnType<typeof evidence>) => searchFindings(await evaluateSearch(input, null, ['presentation']))
      .find(item => item.checkId === 'title-missing')!
    const originalHtml = await source(evidence(missing, { rendered: document(null) }))
    const rendered = await source(evidence(missing, { original: document(present) }))
    const receipt = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'after', pageUrl: PAGE,
      collectedAt: '2026-10-20T12:00:00Z', complete: true,
      observations: await evaluateSearch(evidence(missing, { original: document(present) }), null, ['presentation']) })
    const reader = createRecordedRecoveryReader({ auditId: 'after', executionSpec: { ...spec, checks: { 'title-missing': 1 } },
      executions: [{ targetKey: 'module:search-presentation', status: 'COMPLETED', detail: receipt }] })
    expect(reader.verdict(originalHtml)).toBe('passed')
    expect(reader.verdict(rendered)).toBe('failed')
    expect(reader.verdict(originalHtml)).toBe('passed')
    const origin = { auditId: 'before', taskId: 'original', checkVersion: 1 }
    const combined = { ...originalHtml, supportingObservations: mergeSupportingObservations([
      observationsForFlag(originalHtml, origin), observationsForFlag(rendered, { ...origin, taskId: 'rendered' }),
    ]) }
    expect(reader.verdict(combined)).toBe('failed')
  })

  it('does not admit a prepared reader belonging to another verification audit', () => {
    const receipt = response()
    const reader = createRecordedRecoveryReader({ auditId: 'after', executionSpec: spec, executions: [receipt] })
    const decision = assessVerificationCoverage({ auditId: 'foreign', status: 'COMPLETED', reportCompleteness: 'FULL',
      evidenceCoverage: {}, failedModules: [], journeyReviewIncluded: false, journeyReviewAt: null, pages: [],
      source: 'DETERMINISTIC', checkId: 'no-https', pageUrl: PAGE, executionSpec: spec, originalFlag: flag(), verifierExecutions: [] }, reader)
    expect(decision.comparable).toBe(false)
    expect(decision.verdict).not.toBe('passed')
  })
})
