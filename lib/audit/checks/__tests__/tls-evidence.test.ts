import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectDocument } from '../../search/collect'
import { runAllChecks } from '../index'
import { publicDocumentSchema } from '../../search/contracts'
import { checkReceiptSchema } from '../receipt'
import { scopedAssertionForTarget } from '../verification'

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
      [{ ...document, transportFailure: undefined }, pageUrl, false],
      [{ ...response, finalUrl: 'http://example.com/' }, pageUrl, false],
      [{ ...response, url: pageUrl + 'changed' }, pageUrl + 'changed', false],
      [response, pageUrl, true]] as const) {
      const result = await evaluate(input, url)
      const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, pageUrl: url,
        ...result.executions[0], execution: { auditId: 'fresh', taskId: 'fresh-http', checkVersion: 1,
          checkVersions: { 'security-certificate-invalid': 1 }, source: 'http', collectedAt: new Date().toISOString() } })
      const proof = scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })
      if (repaired) expect(proof?.assertion).toMatchObject({ complete: true, passed: true })
      else expect(proof?.assertion?.passed).not.toBe(true)
    }
  })
})
