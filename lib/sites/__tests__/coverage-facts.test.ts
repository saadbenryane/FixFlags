import { describe, expect, it, vi } from 'vitest'
import { buildCoverageFacts } from '../coverage'
import { runAllChecks } from '@/lib/audit/checks'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { NATIVE_CONSTRAINT_OBSERVATION } from '@/lib/audit/checks/form-validation'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'
import { publicLinkObservations } from '@/lib/audit/checks/public-links'

const pageUrl = 'https://example.test/', now = new Date('2026-10-20T12:00:00Z')
const optional = (status: string) => ({ targetKey: 'module:trust', status, pageUrl, detail: {
  kind: 'site-module-check', version: 1, module: 'trust', pageUrl, applicable: false, complete: false, passed: false,
  assertions: [{ key: 'privacy-link', name: 'Privacy', expected: 'A declaration', observed: 'Not inspected', complete: false, passed: false }],
} })
const fact = (executions: Array<{ targetKey: string; status: string; detail: unknown }>) =>
  buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now, evidenceCoverage: {}, flags: [], verifierExecutions: executions })
    .find(item => item.area === 'security')!
describe('applicability and independent coverage facts', () => {
  it.each([
    ['matching response', false], ['matching broken response', false], ['another page', true], ['another query', true],
    ['another Run', true], ['another version', true], ['second response unavailable', true], ['inventory incomplete', true],
    ['another link still unavailable', true], ['earlier conclusive response', true],
  ] as const)('reconciles public link coverage for %s', (scenario, incomplete) => {
    const destination = pageUrl + 'pricing?plan=team'
    function observe(phase: 'first' | 'second', options: { page?: string; url?: string; audit?: string; version?: number;
      status: 200 | 404 | 429; complete?: boolean; extra?: boolean }) {
      const page = options.page ?? pageUrl, url = options.url ?? destination
      const checked = publicLinkObservations(page, [url, ...(options.extra ? [pageUrl + 'other-link'] : [])],
        [{ url, status: options.status, outcome: options.status === 200 ? 'reachable' : options.status === 404 ? 'not_found' : 'blocked',
          shouldFlagDead: options.status === 404 }], options.complete)
      return { targetKey: 'module:seo', status: 'COMPLETED', pageUrl: page, scopeKey: `page:${page}:public-links:${phase}:batch:0`,
        detail: { kind: 'site-module-check', version: 1, module: 'seo', pageUrl: page, applicable: true,
          passed: checked.complete && checked.flags.length === 0, complete: checked.complete, limitation: checked.limitation,
          ...(scenario === 'matching response' ? {} : { publicLinkInventoryComplete: options.complete !== false }),
          assertions: checked.assertions, execution: { auditId: options.audit ?? 'a', taskId: phase, checkVersion: options.version ?? 1,
            source: 'http', collectedAt: now.toISOString() } } }
    }
    const first = observe('first', { status: scenario === 'earlier conclusive response' ? 200 : 429,
      complete: scenario !== 'inventory incomplete', extra: scenario === 'another link still unavailable' })
    const second = observe('second', { status: ['second response unavailable', 'earlier conclusive response'].includes(scenario) ? 429
      : scenario === 'matching broken response' ? 404 : 200, page: scenario === 'another page' ? pageUrl + 'docs' : undefined,
      url: scenario === 'another query' ? pageUrl + 'pricing?plan=solo' : undefined,
      audit: scenario === 'another Run' ? 'b' : undefined, version: scenario === 'another version' ? 2 : undefined })
    const search = buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now, evidenceCoverage: { metadata: true }, flags: [],
      verifierExecutions: [second, first] }).find(item => item.area === 'search')!
    expect(Boolean(search.incompleteReason)).toBe(incomplete)
  })

  it('uses actual area observations instead of a later completion or unrelated fresh evidence', () => {
    const observed = (module: string, keys: string[], collectedAt: string) => ({ targetKey: 'module:' + module, status: 'COMPLETED', detail: {
      kind: 'site-module-check', version: 1, module, pageUrl, applicable: true, complete: true, passed: true,
      assertions: keys.map(key => ({ key, name: 'Observed responsibility', expected: 'A completed observation', observed: 'Observed', passed: true, complete: true })),
      execution: { auditId: 'a', taskId: module, checkVersion: 1, source: module === 'accessibility' ? 'browser-accessibility' : 'http', collectedAt },
    } })
    const old = '2026-10-11T12:00:00.000Z'
    const receipts = [observed('security', ['https', 'resource-transport'], old),
      observed('trust', ['privacy-link', 'contact-information'], now.toISOString()),
      observed('accessibility', ['automated-accessibility'], now.toISOString())]
    const decode = vi.spyOn(checkReceiptSchema, 'safeParse')
    try {
      const facts = buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now, evidenceCoverage: {}, flags: [], verifierExecutions: receipts })
      expect(facts.find(fact => fact.area === 'security')).toMatchObject({ state: 'unknown', stale: true, checkedAt: old })
      expect(facts.find(fact => fact.area === 'accessibility')).toMatchObject({ state: 'healthy', checkedAt: now.toISOString() })
      expect(decode.mock.calls.map(([receipt]) => receipt)).toEqual(receipts.map(row => row.detail))
    } finally { decode.mockRestore() }
  })
  it('does not let a native constraint shortcut establish current Conversion coverage', () => {
    const form = { targetKey: 'module:form-validation', status: 'COMPLETED', detail: { kind: 'site-module-check', version: 1,
      module: 'form-validation', pageUrl, passed: true, applicable: true, complete: true,
      assertions: [{ key: 'form-feedback', name: 'Feedback', expected: 'Immediate feedback', observed: NATIVE_CONSTRAINT_OBSERVATION,
        passed: true, complete: true }] } }
    expect(buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now, evidenceCoverage: { flowScan: true }, flags: [],
      verifierExecutions: [form] }).find(item => item.area === 'conversion'))
      .toMatchObject({ state: 'unknown', incompleteReason: expect.any(String) })
  })
  it.each(['NOT_APPLICABLE', 'COMPLETED', 'FAILED'])('preserves independent public evidence beside a %s optional receipt', async status => {
    const html = '<main><h1>Useful service</h1></main>'
    const checked = await runAllChecks(pageUrl, parseMetadataFromHtml(html, pageUrl),
      null, null, [], undefined, undefined, undefined, undefined, true, ['security'],
      { publicDocument: { url: pageUrl, finalUrl: pageUrl, status: 200, headers: { 'content-type': 'text/html' }, body: html,
        complete: true, reason: null, collectedAt: now.toISOString(), redirects: [] } })
    const observed = { targetKey: 'module:security', status: 'COMPLETED', pageUrl, detail: {
      kind: 'site-module-check', version: 1, ...checked.executions[0], pageUrl,
      execution: { auditId: 'a', taskId: 'security', checkVersion: 1, source: 'http', collectedAt: now.toISOString() },
    } }
    expect(fact([observed, optional(status)]).state).toBe(status === 'NOT_APPLICABLE' ? 'healthy' : 'unknown')
  })
  it('never lets inapplicability supply missing evidence', () => {
    expect(fact([optional('NOT_APPLICABLE')])).toMatchObject({ state: 'unknown', evidenced: false })
  })
})
