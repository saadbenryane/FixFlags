import { describe, expect, it } from 'vitest'
import { buildCoverageFacts } from '../coverage'
import { runAllChecks } from '@/lib/audit/checks'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { NATIVE_CONSTRAINT_OBSERVATION } from '@/lib/audit/checks/form-validation'

const pageUrl = 'https://example.test/', now = new Date('2026-10-20T12:00:00Z')
const optional = (status: string) => ({ targetKey: 'module:trust', status, pageUrl, detail: {
  kind: 'site-module-check', version: 1, module: 'trust', pageUrl, applicable: false, complete: false, passed: false,
  assertions: [{ key: 'privacy-link', name: 'Privacy', expected: 'A declaration', observed: 'Not inspected', complete: false, passed: false }],
} })
const fact = (executions: Array<{ targetKey: string; status: string; detail: unknown }>) =>
  buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: now, now, evidenceCoverage: {}, flags: [], verifierExecutions: executions })
    .find(item => item.area === 'security')!
describe('applicability and independent coverage facts', () => {
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
      { publicDocument: { url: pageUrl, finalUrl: pageUrl, status: 200, headers: {}, body: html,
        complete: true, reason: null, collectedAt: now.toISOString(), redirects: [] } })
    const observed = { targetKey: 'module:security', status: 'COMPLETED', pageUrl, detail: {
      kind: 'site-module-check', version: 1, ...checked.executions[0], pageUrl,
    } }
    expect(fact([observed, optional(status)]).state).toBe(status === 'NOT_APPLICABLE' ? 'healthy' : 'unknown')
  })
  it('never lets inapplicability supply missing evidence', () => {
    expect(fact([optional('NOT_APPLICABLE')])).toMatchObject({ state: 'unknown', evidenced: false })
  })
})
