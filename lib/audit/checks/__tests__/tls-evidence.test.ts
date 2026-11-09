import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectDocument } from '../../search/collect'
import { runAllChecks } from '../index'
import { publicDocumentSchema } from '../../search/contracts'
import { checkReceiptSchema } from '../receipt'
import { scopedAssertionForTarget } from '../verification'
import { legacyCertificateRequestContext } from '../certificate-scope'
import { LEGACY_TLS_CERTIFICATE_VERIFICATION_RULE } from '../../tls-evidence'
import { observationsForFlag } from '../../flag-observations'
import { assessSecurityTransport } from '../security'

const fixture = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/audit/url', async original => ({ ...await original<typeof import('@/lib/audit/url')>(), safeFetchDocument: fixture.fetch }))
const pageUrl = 'https://example.com/?token=PRIVATE_VALUE'
beforeEach(() => { fixture.fetch.mockReset() })

describe('public certificate evidence', () => {
  it('retains an observed peer failure without fabricating headers or a response', async () => {
    fixture.fetch.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED', secret: 'PRIVATE_ERROR_VALUE' } }))
    const document = await collectDocument(pageUrl, Date.now() + 5000)
    expect(document).toMatchObject({ status: null, headers: {}, body: null, complete: false,
      transportFailure: { kind: 'tls-certificate', code: 'CERT_HAS_EXPIRED' } })
    expect(JSON.stringify(document)).not.toContain('PRIVATE_ERROR_VALUE')
  })
  it('creates a useful Security finding while keeping missing HTTP and HTML evidence unknown', async () => {
    fixture.fetch.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } }))
    const document = await collectDocument(pageUrl, Date.now() + 5000)
    const result = await runAllChecks(pageUrl, null, null, null, [], undefined, undefined, undefined, undefined, true,
      ['security'], { publicDocument: document })
    const flag = result.flags.find(item => item.checkId === 'security-certificate-invalid')
    expect(flag).toBeDefined()
    expect(flag!.problem).toContain('expired')
    expect(flag!.fix).toMatch(/renew/i)
    expect(flag!.evidence).not.toContain('PRIVATE_VALUE')
    expect(result.executions[0].assertions).toContainEqual(expect.objectContaining({ key: 'tls-certificate', passed: false, complete: true }))
    expect(result.executions[0].complete).toBe(false)
  })
  it('rejects contradictory transport evidence instead of accepting an invented response', async () => {
    fixture.fetch.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } }))
    const document = await collectDocument(pageUrl, Date.now() + 5000)
    expect(publicDocumentSchema.safeParse(document).success).toBe(true)
    for (const change of [{ status: 200 }, { headers: { server: 'invented' } }, { body: 'invented' },
      { complete: true }, { finalUrl: 'http://example.com/' }, { finalUrl: 'not a URL' }])
      expect(publicDocumentSchema.safeParse({ ...document, ...change }).success).toBe(false)
  })
  it('requires a fresh HTTPS response for the original request, independent of other missing evidence', async () => {
    fixture.fetch.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } }))
    const document = await collectDocument(pageUrl, Date.now() + 5000)
    const evaluate = async (input: typeof document, url = pageUrl) => runAllChecks(url, null, null, null, [],
      undefined, undefined, undefined, undefined, true, ['security'], { publicDocument: input })
    const flag = (await evaluate(document)).flags.find(flag => flag.checkId === 'security-certificate-invalid')!
    const response = { ...document, transportFailure: undefined, reason: null, status: 200, complete: true, body: '' }
    for (const [input, url, repaired] of [[document, pageUrl, false],
      [{ ...document, transportFailure: undefined }, pageUrl, undefined],
      [{ ...response, finalUrl: 'http://example.com/' }, pageUrl, undefined],
      [{ ...response, url: pageUrl + 'changed' }, pageUrl + 'changed', undefined],
      [{ ...response, finalUrl: 'https://example.net/' }, pageUrl, undefined],
      [{ ...response, finalUrl: 'https://example.com:8443/' }, pageUrl, undefined],
      [{ ...response, finalUrl: 'https://example.net/', redirects: [pageUrl] }, pageUrl, true],
      [response, pageUrl, true]] as const) {
      const result = await evaluate(input, url)
      const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, pageUrl: url,
        ...result.executions[0], execution: { auditId: 'fresh', taskId: 'fresh-http', checkVersion: 1,
          checkVersions: { 'security-certificate-invalid': 1 }, source: 'http', collectedAt: new Date().toISOString() } })
      const proof = scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })
      if (repaired === undefined) expect(proof).toBeUndefined()
      else expect(proof?.assertion).toMatchObject({ complete: true, passed: repaired })
    }
  })

  it('compares retained legacy evidence only for its recorded endpoint', async () => {
    fixture.fetch.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } }))
    const document = await collectDocument(pageUrl, Date.now() + 5000)
    const endpoint = 'https://example.com:8443/secure'
    const source = assessSecurityTransport(pageUrl, null, { ...document, finalUrl: endpoint, redirects: [pageUrl] })
    const measured = source.flags[0]
    const flag = { ...measured, verificationRule: LEGACY_TLS_CERTIFICATE_VERIFICATION_RULE,
      evidenceTargets: measured.evidenceTargets!.map(target => ({ ...target, context: legacyCertificateRequestContext(pageUrl) })) }
    const provenance = { checkVersion: 1, auditId: 'original', taskId: 'original-security', collectedAt: document.collectedAt }
    const originalObservations = observationsForFlag(flag, provenance).items
    const receiptFor = (finalUrl: string, historical: boolean) => {
      const checked = assessSecurityTransport(pageUrl, null, { ...document, finalUrl, redirects: [pageUrl],
        transportFailure: undefined, status: 200, reason: null, body: '', complete: true })
      return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'security', applicable: true,
        passed: true, pageUrl, assertions: checked.assertions.map(assertion => historical && assertion.key === 'tls-certificate'
          ? { ...assertion, measurements: undefined, context: legacyCertificateRequestContext(pageUrl) } : assertion),
        execution: { auditId: 'fresh', taskId: 'fresh-security', checkVersion: 1, source: 'http', collectedAt: document.collectedAt } })
    }
    for (const historical of [true, false]) {
      const receipt = receiptFor(endpoint, historical)
      expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag, originalObservations })?.assertion)
        .toMatchObject({ complete: true, passed: true })
      expect(scopedAssertionForTarget({ receipt: receiptFor('https://example.com/secure', historical),
        checkId: flag.checkId, flag, originalObservations })).toBeUndefined()
      expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })).toBeUndefined()
      expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag,
        originalObservations: observationsForFlag({ ...flag, evidence: 'Unstructured note about ' + endpoint }, provenance).items })).toBeUndefined()
    }
  })
})
