import { describe, expect, it } from 'vitest'
import { CHECK_REGISTRY } from '../check-registry'
import { initialTaskPlan } from '../progressive/graph'
import { runAllChecks } from './index'
import { parseMetadataFromHtml } from '../metadata'
import { runTrustChecks } from './trust'
import { assertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'
import { assessSecurityTransport, runSecurityBasicsChecks, securityObservations } from './security'
import { document } from '../search/__tests__/fixtures'

const url = 'http://example.com/'
describe('HTTPS transport ownership', () => {
  it('routes the original HTTP finding and its positive repair assertion through one public collector', async () => {
    const metadata = parseMetadataFromHtml('<main><h1>Useful service</h1></main>', url)
    const before = await runAllChecks(url, metadata, null, null, [], undefined, undefined, undefined, undefined, true, ['security'])
    expect(before.flags.map(flag => flag.checkId)).toContain('no-https')
    expect(runTrustChecks(url, metadata).map(flag => flag.checkId)).not.toContain('no-https')
    expect(CHECK_REGISTRY['no-https'].module).toBe('security')
    const after = await runAllChecks('https://example.com/', metadata, null, null, [], undefined, undefined, undefined, undefined, true, ['security'])
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, pageUrl: url, ...after.executions[0] })
    expect(assertionForTarget(receipt, 'no-https')).toMatchObject({ key: 'https', passed: true, complete: true })
    const spec = { version: 1 as const, engine: 'progressive-v1' as const, targetUrl: url, environment: 'production' as const,
      scope: 'DIAGNOSTIC' as const, checks: { 'no-https': 1 }, outcomes: [], verificationTarget: { kind: 'DIAGNOSTIC' as const,
        pageUrl: url, checkId: 'no-https', parentAuditId: 'source', attemptId: 'attempt' } }
    expect(initialTaskPlan(spec).map(task => task.kind).sort()).toEqual(['check', 'finalize', 'http'])
  })
  it('does not require HTML to observe protocol and never certifies missing resource evidence', () => {
    expect(securityObservations('https://example.com/', null)).toMatchObject([
      { key: 'https', passed: true, complete: true }, { key: 'resource-transport', passed: false, complete: false },
    ])
    expect(securityObservations(url, null)).toMatchObject([{ key: 'https', passed: false, complete: true }])
    expect(runSecurityBasicsChecks('http://example.com/?token=PRIVATE_VALUE', null)[0].evidence).toBe('URL: http://example.com/')
  })
  it('records an unobserved public response as incomplete and does not open an HTTPS finding', () => {
    const open = assessSecurityTransport('https://example.com/', null, document(null, { status: null, complete: false }))
    expect(open.assertions.find(assertion => assertion.key === 'https')).toMatchObject({ passed: false, complete: false })
    expect(open.flags.map(flag => flag.checkId)).not.toContain('no-https')
  })
})
