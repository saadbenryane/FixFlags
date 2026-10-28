import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn() }))
vi.mock('node:dns/promises', () => dns)
import { collectionHandlers } from '../collectors'
import { evaluatorHandlers } from '../evaluators'
import { httpArtifactSchema } from '../snapshots'
import { PREVIEW_IMAGE_MAX_BYTES } from '../../checks/preview-image-response'
import { readArtifact, serializeArtifact } from '../contracts'
import { checkArtifactSchema } from '../results'
import type { TaskContext } from '../registry'
import { healthyMeta } from '../../__tests__/check-fixtures'
import { scopedAssertionForTarget, recordAssertionVerifiers } from '../../checks/verification'
import { hasRecordedRecoveryEvidence } from '../../recovery-evidence'
import { collapseRecordedFixtureFlags as collapseFlagsWithAffectedPaths } from '@/lib/audit/__tests__/recorded-flag-fixtures'
import { destinationContext, publicLinkContext, DESTINATION_VERIFICATION_RULE, PUBLIC_LINK_VERIFICATION_RULE } from '../../checks/destination-evidence'
import { publicHttpCapacity } from '../capacity'
import { openCheckDestination } from '../../open-check'
import { collectDocument, missingDocument } from '../../search/collect'
import { parseMetadataFromHtml, type PageMetadata } from '../../metadata'

const pageUrl = 'https://example.com/pricing'
const fetchMock = vi.fn()
const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
function context(module: string, metadata = healthyMeta(), page = pageUrl): TaskContext {
  const checkId = module === 'seo' ? 'broken-internal-links' : module === 'og-image' ? 'og-image-broken' : 'checkout-link-dead'
  return { audit: { id: 'after', parentId: 'before', executionSpec: { version: 1, engine: 'progressive-v1',
    targetUrl: page, environment: 'production', scope: module === 'seo' ? 'DIAGNOSTIC' : 'SITE', checks: { [checkId]: 1, 'auth-page-broken': 1 }, outcomes: [],
    verificationTarget: module === 'seo' ? { kind: 'DIAGNOSTIC', checkId, pageUrl: page, parentAuditId: 'before', attemptId: 'attempt' } : null } } as unknown as TaskContext['audit'],
    task: { id: 'check:' + page } as TaskContext['task'],
    input: { pageUrl: page, position: 0, primary: true, role: 'primary', module }, deadline: Date.now() + 10_000,
    dependencies: new Map([['browser', { workKind: 'browser', workState: 'COMPLETED', workResult: serializeArtifact('browser', {
      pageId: 'page', metadata, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: '<html></html>', desktopFinalUrl: page,
        desktopBase64: null, mobileBase64: null, consoleErrors: [], captureStatus: { desktop: 'ok', mobile: 'pending' }, captureFailures: [] },
    }) } as unknown as TaskContext['task']]]) }
}
async function checked(ctx: TaskContext) { return checkArtifactSchema.parse(readArtifact(await evaluate(ctx), 'check').data) }
function headerContext(document: ReturnType<typeof missingDocument>) {
  const ctx = context('security-headers')
  ctx.audit.executionSpec = { version: 1, targetUrl: pageUrl, environment: 'production', scope: 'SITE',
    checks: { 'security-csp-missing': 1 }, outcomes: [], verificationTarget: null }
  ctx.dependencies = new Map([['http', { workKind: 'http', workState: 'COMPLETED',
    workResult: serializeArtifact('http', { document, metadata: null }) } as unknown as TaskContext['task']]])
  return ctx
}
async function withheldHeaders(document: ReturnType<typeof missingDocument>) {
  const result = await checked(headerContext(document))
  expect(result.flags).toEqual([])
  expect(result.receipt).toMatchObject({ applicable: true, passed: false, complete: false, pageUrl,
    limitation: 'This response is not the origin header configuration. Header configuration remains unknown.' })
  expect(result.receipt.assertions.find(assertion => assertion.key === 'content-security-policy'))
    .toMatchObject({ passed: false, complete: false })
  expect(result.receipt.assertions.every(assertion => assertion.complete === false && assertion.passed === false)).toBe(true)
  return result
}
const actionMeta = (links: PageMetadata['links'] = [{ href: '/checkout?plan=paid&token=PRIVATE_VALUE', text: 'Subscribe', rel: null }]) => healthyMeta({ links })
beforeEach(() => {
  fetchMock.mockReset(); dns.resolve4.mockResolvedValue(['93.184.216.34']); dns.resolve6.mockResolvedValue([])
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('guarded public destination evidence', () => {
  it('verifies observed native links without whole-page metadata and keeps out-of-window targets unknown', async () => {
    function nativeContext(href: string | null, complete = true) {
      const ctx = context('seo'), task = ctx.dependencies.get('browser')!
      const data = readArtifact(task.workResult, 'browser').data
      const empty = { html: '', complete: true, reason: null, observed: 0, limit: 2000 }
      task.workResult = serializeArtifact('browser', { ...data, metadata: null, snapshot: { ...data.snapshot as object,
        renderedSearchSnapshot: { version: 1, contract: 'rendered-search-v1', finalUrl: pageUrl, documentBaseUrl: 'https://example.com/catalog/',
          collectedAt: new Date().toISOString(), language: 'en', sections: {
            metadata: empty, indexing: empty, canonical: empty, structured: empty, text: empty,
            links: { ...empty, html: href ? '<a href="' + href + '">Details</a>' : '', observed: complete ? href ? 1 : 0 : 2001,
              complete, reason: complete ? null : 'section_limit' },
          } },
      } })
      return ctx
    }
    fetchMock.mockImplementation(async () => new Response('Missing', { status: 404 }))
    const before = await checked(nativeContext('item'))
    expect(before.flags[0]).toMatchObject({ checkId: 'broken-internal-links', evidenceTargets: [{
      context: publicLinkContext(pageUrl, 'https://example.com/catalog/item'),
    }] })
    fetchMock.mockImplementation(async () => new Response('Ready', { status: 200 }))
    const partial = await checked(nativeContext('item', false))
    expect(partial.receipt).toMatchObject({ complete: false, passed: false, assertions: [{ complete: true, passed: true }] })
    expect(scopedAssertionForTarget({ receipt: partial.receipt, checkId: 'broken-internal-links', flag: before.flags[0] })?.assertion.passed).toBe(true)
    for (const ctx of [nativeContext(null), nativeContext(null, false), nativeContext('other'), nativeContext('item?changed=1')]) {
      const changed = await checked(ctx)
      expect(scopedAssertionForTarget({ receipt: changed.receipt, checkId: 'broken-internal-links', flag: before.flags[0] })).toBeUndefined()
    }
  })

  it.each(['https://example.com/catalog/', 'https://payments.example.com/catalog/'])('resolves public actions and preview images against the captured document base %s', async base => {
    for (const checkModule of ['auth-checkout', 'og-image']) {
      const relative = checkModule === 'auth-checkout' ? 'checkout?plan=paid' : 'preview.png'
      const target = new URL(relative, base).href
      const metadata = parseMetadataFromHtml('<base href="' + base + '"><a href="checkout?plan=paid">Subscribe</a><meta property="og:image" content="preview.png">', pageUrl)
      fetchMock.mockImplementation(async (url: string) => new Response('Response', { status: url === target ? 404 : 200,
        headers: { 'content-type': checkModule === 'og-image' ? 'image/png' : 'text/html' } }))
      const before = await checked(context(checkModule, metadata))
      const checkId = checkModule === 'auth-checkout' ? 'checkout-link-dead' : 'og-image-broken'
      expect(before.flags[0]).toMatchObject({ checkId, evidenceTargets: [{ context: destinationContext(pageUrl, target) }] })
      expect(fetchMock).toHaveBeenCalledWith(target, expect.objectContaining({ redirect: 'manual' }))
      fetchMock.mockImplementation(async () => new Response('Available', { headers: { 'content-type': checkModule === 'og-image' ? 'image/png' : 'text/html' } }))
      const repaired = await checked(context(checkModule, metadata))
      expect(scopedAssertionForTarget({ receipt: repaired.receipt, checkId, flag: before.flags[0] })?.assertion.passed).toBe(true)
      const changed = await checked(context(checkModule, parseMetadataFromHtml('<base href="https://example.com/other/"><a href="checkout?plan=paid">Subscribe</a><meta property="og:image" content="preview.png">', pageUrl)))
      expect(scopedAssertionForTarget({ receipt: changed.receipt, checkId, flag: before.flags[0] })).toBeUndefined()
      const historical = { ...before.flags[0], evidenceTargets: [{ kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const,
        label: 'Earlier incorrectly resolved destination', context: destinationContext(pageUrl, new URL(relative, pageUrl).href) }] }
      expect(scopedAssertionForTarget({ receipt: repaired.receipt, checkId, flag: historical })).toBeUndefined()
      fetchMock.mockClear()
    }
  })

  it('keeps private document-base destinations unavailable without contacting them', async () => {
    const metadata = parseMetadataFromHtml('<base href="http://127.0.0.1/private/"><a href="checkout">Subscribe</a><meta property="og:image" content="preview.png">', pageUrl)
    for (const checkModule of ['auth-checkout', 'og-image']) {
      const result = await checked(context(checkModule, metadata))
      expect(result).toMatchObject({ flags: [], receipt: { complete: false, passed: false } })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('verifies broken public links with the same GET evidence used for discovery', async () => {
    const ctx = context('seo', actionMeta([{ href: '/missing', text: 'Details', rel: null }]))
    fetchMock.mockResolvedValue(new Response('<title>Page not found</title>', { status: 200, headers: { 'content-type': 'text/html' } }))
    const before = await checked(ctx)
    expect(before.flags[0]).toMatchObject({ checkId: 'broken-internal-links', verificationRule: PUBLIC_LINK_VERIFICATION_RULE,
      evidenceTargets: [{ context: publicLinkContext(pageUrl, 'https://example.com/missing') }] })
    expect(before.receipt.assertions[0]).toMatchObject({ passed: false, complete: true })
    fetchMock.mockResolvedValue(new Response('<title>Useful details</title>', { status: 200, headers: { 'content-type': 'text/html' } }))
    const after = await checked(ctx)
    expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: 'broken-internal-links', flag: before.flags[0] })?.assertion.passed).toBe(true)
    const historical = { ...before.flags[0], verificationRule: DESTINATION_VERIFICATION_RULE,
      evidenceTargets: before.flags[0].evidenceTargets?.map(target => ({ ...target,
        context: destinationContext(pageUrl, 'https://example.com/missing') })) }
    expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: 'broken-internal-links', flag: historical })).toBeUndefined()
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: ctx.audit.executionSpec, flag: before.flags[0],
      executions: [{ targetKey: 'module:seo', status: 'COMPLETED', detail: after.receipt }] })).toBe(true)
    const removed = await checked(context('seo', actionMeta([])))
    expect(scopedAssertionForTarget({ receipt: removed.receipt, checkId: 'broken-internal-links', flag: before.flags[0] })).toBeUndefined()
    fetchMock.mockResolvedValue(new Response('Blocked', { status: 429 }))
    const blocked = await checked(ctx)
    expect(blocked.flags).toEqual([])
    expect(blocked.receipt).toMatchObject({ complete: false, assertions: [{ passed: false, complete: false }] })
  })

  it('inspects the original public URL even when its inventory identity drops locale and query variants', async () => {
    const url = 'https://www.example.com/en/missing/?lang=en&page=2&token=PRIVATE_VALUE'
    fetchMock.mockResolvedValue(new Response('Missing', { status: 404 }))
    const result = await checked(context('seo', actionMeta([{ href: url, text: 'Details', rel: null }])))
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'manual' }))
    expect(result.flags[0].evidenceTargets?.[0].context).toBe(publicLinkContext(pageUrl, url))
    expect(JSON.stringify(result)).not.toContain('PRIVATE_VALUE')
  })

  it('records GET failures, verifies the same repaired targets and recognizes recurrence', async () => {
    const ctx = context('auth-checkout', actionMeta())
    fetchMock.mockImplementation(async (_url, init) => new Response('Gone', { status: init.method === 'HEAD' ? 200 : 404 }))
    const before = await checked(ctx)
    expect(before.flags.map(flag => flag.checkId)).toEqual(['checkout-link-dead'])
    expect(before.receipt).toMatchObject({ complete: true, passed: false, execution: { source: 'http', taskId: ctx.task.id },
      assertions: [{ key: 'checkout-destination', passed: false, complete: true }] })
    expect(JSON.stringify(before)).not.toContain('PRIVATE_VALUE')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('token=PRIVATE_VALUE'), expect.objectContaining({ redirect: 'manual' }))
    fetchMock.mockResolvedValue(new Response('Checkout ready', { status: 200 }))
    const after = await checked(ctx), flag = { ...before.flags[0], pageUrl }
    const scoped = scopedAssertionForTarget({ receipt: after.receipt, checkId: flag.checkId, flag })
    expect(scoped?.assertion).toMatchObject({ passed: true, complete: true })
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: ctx.audit.executionSpec, flag,
      executions: [{ targetKey: 'module:auth-checkout', status: 'COMPLETED', detail: after.receipt }] })).toBe(true)
    const upsert = vi.fn()
    const tx = {get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },  improvementAttempt: { findMany: vi.fn().mockResolvedValue([{ improvement: { occurrences: [{ flag: { ...flag, source: 'DETERMINISTIC' } }] } }]) },
      auditVerifierExecution: { findMany: vi.fn().mockResolvedValue([]), upsert } }
    await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: after.receipt }, tx as never)
    expect(upsert.mock.calls[0][0].create.detail).toMatchObject({ verdict: 'passed', source: 'http' })
    fetchMock.mockResolvedValue(new Response('Gone again', { status: 503 }))
    const recurrence = await checked(ctx)
    expect(recurrence.flags[0].evidenceTargets).toEqual(before.flags[0].evidenceTargets)
    expect(scopedAssertionForTarget({ receipt: recurrence.receipt, checkId: flag.checkId, flag })?.assertion.passed).toBe(false)
  })

  it('never uses another destination, a changed query, missing markup or an unknown response to certify repair', async () => {
    fetchMock.mockResolvedValue(new Response('Checkout', { status: 200 }))
    const ctx = context('auth-checkout', actionMeta())
    const after = await checked(ctx)
    const flag = { verificationRule: DESTINATION_VERIFICATION_RULE, evidenceTargets: [{ context: destinationContext(pageUrl, 'https://example.com/checkout?plan=other&token=PRIVATE_VALUE') }] }
    expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: 'checkout-link-dead', flag })).toBeUndefined()
    const noLinks = await checked(context('auth-checkout', actionMeta([])))
    expect(scopedAssertionForTarget({ receipt: noLinks.receipt, checkId: 'checkout-link-dead', flag })).toBeUndefined()
    for (const status of [401, 403, 429]) {
      fetchMock.mockResolvedValue(new Response('Restricted', { status }))
      const restricted = await checked(ctx)
      expect(restricted.flags).toEqual([])
      expect(restricted.receipt).toMatchObject({ complete: false, passed: false, assertions: [{ complete: false }] })
    }
    fetchMock.mockRejectedValue(new Error('offline'))
    const interrupted = await checked(ctx)
    expect(interrupted.receipt).toMatchObject({ complete: false, passed: false })
    expect(interrupted.flags).toEqual([])
  })

  it('keeps a known repaired target independent of unrelated blocked destinations and reports inventory limits', async () => {
    fetchMock.mockImplementation(async (url: string) => new Response('Response', { status: url.includes('/checkout?') ? 200 : 429 }))
    const metadata = actionMeta([...actionMeta().links, ...Array.from({ length: 9 }, (_, index) => ({ href: '/login/' + index, text: 'Log in', rel: null }))])
    const result = await checked(context('auth-checkout', metadata))
    expect(result.receipt).toMatchObject({ complete: false, passed: false })
    expect(result.receipt.assertions).toHaveLength(8)
    expect(fetchMock).toHaveBeenCalledTimes(8)
    const flag = { verificationRule: DESTINATION_VERIFICATION_RULE,
      evidenceTargets: [{ context: destinationContext(pageUrl, 'https://example.com' + metadata.links[0].href) }] }
    expect(scopedAssertionForTarget({ receipt: result.receipt, checkId: 'checkout-link-dead', flag })?.assertion.passed).toBe(true)
    expect(publicHttpCapacity.running).toBe(0)
  })

  it('requires every failed target across collapsed page findings for explicit and automatic recovery', async () => {
    const pages = [pageUrl, 'https://example.com/about']
    fetchMock.mockImplementation(async () => new Response('Missing', { status: 404 }))
    const before = await Promise.all(pages.map(page => checked(context('auth-checkout', actionMeta(), page))))
    const flag = collapseFlagsWithAffectedPaths(before.map((result, index) => ({ ...result.flags[0], pageUrl: pages[index] })))[0]
    fetchMock.mockImplementation(async () => new Response('Available', { status: 200 }))
    const after = await Promise.all(pages.map(page => checked(context('auth-checkout', actionMeta(), page))))
    expect(scopedAssertionForTarget({ receipt: after[0].receipt, checkId: flag.checkId, flag })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: after[0].receipt, receipts: [after[1].receipt], checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
    const rows = after.map(result => ({ targetKey: 'module:auth-checkout', status: 'COMPLETED', detail: result.receipt }))
    const input = { auditId: 'after', executionSpec: context('auth-checkout').audit.executionSpec, flag }
    expect(hasRecordedRecoveryEvidence({ ...input, executions: rows })).toBe(true)
    expect(hasRecordedRecoveryEvidence({ ...input, executions: rows.slice(0, 1) })).toBe(false)
  })

  it('rejects private destinations, DNS answers and redirect targets without contacting them', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 302, headers: { location: 'http://127.0.0.1/checkout' } }))
    const redirected = await checked(context('auth-checkout', actionMeta()))
    expect(redirected.flags).toEqual([])
    expect(redirected.receipt.complete).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockClear(); dns.resolve4.mockResolvedValue(['10.0.0.1'])
    const privateDns = await openCheckDestination('https://example.com/checkout')
    expect(privateDns.outcome).toBe('blocked')
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await openCheckDestination('http://127.0.0.1/checkout')).outcome).toBe('blocked')
  })

  it('checks the image GET content type and never calls timeouts or scanner refusals broken images', async () => {
    const ctx = context('og-image', healthyMeta({ ogImage: '/preview.png?token=PRIVATE_IMAGE_VALUE' }))
    fetchMock.mockImplementation(async () => new Response('<html>Error</html>', { headers: { 'content-type': 'text/html' } }))
    const before = await checked(ctx)
    expect(before.flags[0].checkId).toBe('og-image-broken')
    expect(JSON.stringify(before)).not.toContain('PRIVATE_IMAGE_VALUE')
    fetchMock.mockImplementation(async () => new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVQImWP4r8TwX4kBhP8rMQAAI6YEhXbc9zcAAAAASUVORK5CYII=', 'base64'), { headers: { 'content-type': 'image/png' } }))
    const after = await checked(ctx)
    expect(after.receipt).toMatchObject({ complete: true, passed: true, execution: { source: 'http' } })
    expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: 'og-image-broken', flag: before.flags[0] })?.assertion.passed).toBe(true)
    fetchMock.mockRejectedValue(new DOMException('Timeout', 'AbortError'))
    const missing = await checked(ctx)
    expect(missing.flags).toEqual([])
    expect(missing.receipt).toMatchObject({ complete: false, passed: false })
    dns.resolve4.mockResolvedValue(['192.168.0.1']); fetchMock.mockClear()
    expect((await checked(ctx)).receipt.complete).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels a large image body at the sampling bound and refuses new requests after the deadline', async () => {
    const cancel = vi.fn()
    fetchMock.mockImplementation(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(PREVIEW_IMAGE_MAX_BYTES + 1).fill(1)) }, cancel,
    }), { headers: { 'content-type': 'image/png' } }))
    const ctx = context('og-image')
    const limited = await checked(ctx)
    expect(limited.flags).toEqual([])
    expect(limited.receipt).toMatchObject({ passed: false, complete: false, assertions: [
      { key: 'preview-image-response', passed: true, complete: true },
      { key: 'preview-image-decoding', passed: false, complete: false },
    ] })
    expect(cancel).toHaveBeenCalledOnce()
    fetchMock.mockClear()
    const expired = await checked({ ...ctx, deadline: Date.now() - 1 })
    expect(expired.receipt).toMatchObject({ passed: false, complete: false })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(publicHttpCapacity.running).toBe(0)
  })

  it('keeps successful challenge responses unknown for both public action links and preview images', async () => {
    fetchMock.mockImplementation(async () => new Response('<title>Just a moment...</title>', { status: 200,
      headers: { 'cf-mitigated': 'challenge', 'content-type': 'text/html' } }))
    for (const ctx of [context('auth-checkout', actionMeta()), context('og-image')]) {
      const result = await checked(ctx)
      expect(result.flags).toEqual([])
      expect(result.receipt).toMatchObject({ passed: false, complete: false, assertions: [{ passed: false, complete: false }] })
    }
  })

  it('records a missing captured link list as incomplete and does not invent a broken link', async () => {
    const ctx = context('seo')
    const task = ctx.dependencies.get('browser')!
    const data = readArtifact(task.workResult, 'browser').data
    task.workResult = serializeArtifact('browser', { ...data, metadata: null })
    const captured = readArtifact(task.workResult, 'browser')
    const result = await checked(ctx)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.flags).toEqual([])
    expect(result.receipt).toMatchObject({ applicable: true, passed: false, complete: false, pageUrl,
      limitation: 'The captured link list was not collected. Public destinations remain unknown.',
      assertions: [{ key: 'public-destination', passed: false, complete: false }],
      execution: { source: 'rendered-dom', collectedAt: captured.collectedAt } })
  })

  it('does not diagnose origin security headers from a challenge document', async () => {
    fetchMock.mockImplementation(async () => new Response('<title>Just a moment...</title>', { status: 200,
      headers: { 'cf-mitigated': 'challenge', 'content-security-policy': "default-src 'none'" } }))
    const document = await collectDocument(pageUrl, Date.now() + 10_000)
    expect(document).toMatchObject({ status: 200, reason: 'public_access_challenge' })
    await withheldHeaders(document)
  })

  it('records an unresolved redirect as incomplete header evidence', async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      return new Response(null, { status: 302, headers: { location: url, 'content-security-policy': "default-src 'none'" } })
    })
    const document = await collectDocument(pageUrl, Date.now() + 10_000)
    expect(document).toMatchObject({ status: 302, reason: 'redirect_loop' })
    await withheldHeaders(document)
  })

  it.each([401, 403, 429])('records a restricted %s response as incomplete header evidence', async status => {
    fetchMock.mockImplementation(async () => new Response('Forbidden area', { status,
      headers: { 'content-type': 'text/html', 'content-security-policy': "default-src 'none'" } }))
    const document = await collectDocument(pageUrl, Date.now() + 10_000)
    expect(document.status).toBe(status)
    expect(document.reason).not.toBe('public_access_challenge')
    await withheldHeaders(document)
  })

  it('records a settled response without a status as incomplete header evidence', async () => {
    const missing = await checked(headerContext(missingDocument(pageUrl, 'public_document_unavailable')))
    expect(missing.flags).toEqual([])
    expect(missing.receipt).toMatchObject({ applicable: true, passed: false, complete: false, pageUrl })
    expect(missing.receipt.assertions.find(assertion => assertion.key === 'content-security-policy'))
      .toMatchObject({ passed: false, complete: false })
    expect(missing.receipt.assertions.every(assertion => assertion.complete === false && assertion.passed === false)).toBe(true)
    const collected = { ...missingDocument(pageUrl, 'public_document_unavailable'), status: 200, headers: {}, body: '', complete: true, reason: null }
    const flagged = await checked(headerContext(collected))
    expect(flagged.flags.map(flag => flag.checkId)).toEqual(['security-headers-missing'])
    expect(flagged.receipt.assertions.find(assertion => assertion.key === 'content-security-policy'))
      .toMatchObject({ passed: false, complete: true })
  })

  it('stores a public document that never completes and keeps header evidence incomplete', async () => {
    const http = collectionHandlers.find(handler => handler.kind === 'http')!
    async function stored(ctx: TaskContext) {
      const artifact = await http.evaluate(ctx)
      http.validateResult(artifact)
      const parsed = httpArtifactSchema.parse(readArtifact(artifact, 'http').data)
      ctx.audit.executionSpec = { version: 1, targetUrl: pageUrl, environment: 'production', scope: 'SITE',
        checks: { 'security-csp-missing': 1 }, outcomes: [], verificationTarget: null }
      ctx.dependencies = new Map([['http', { workKind: 'http', workState: 'COMPLETED', workResult: artifact } as unknown as TaskContext['task']]])
      return { parsed, headers: await checked(ctx) }
    }
    const expired = context('security-headers')
    expired.deadline = Date.now() - 1
    const late = await stored(expired)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(late.parsed.document).toMatchObject({ status: null, complete: false, reason: 'deadline_exhausted' })
    expect(late.headers.flags).toEqual([])
    expect(late.headers.receipt).toMatchObject({ applicable: true, passed: false, complete: false })
    expect(late.headers.receipt.assertions.find(assertion => assertion.key === 'content-security-policy'))
      .toMatchObject({ passed: false, complete: false })
    fetchMock.mockRejectedValue(new Error('socket hang up'))
    const unavailable = await stored(context('security-headers'))
    expect(unavailable.parsed.document).toMatchObject({ status: null, complete: false, reason: 'public_document_unavailable' })
    expect(unavailable.headers.flags).toEqual([])
    expect(unavailable.headers.receipt).toMatchObject({ applicable: true, passed: false, complete: false })
  })

  it('bounds DNS waiting and releases HTTP capacity without sending a late request', async () => {
    let settle!: (addresses: string[]) => void
    dns.resolve4.mockReturnValue(new Promise<string[]>(resolve => { settle = resolve }))
    const result = await openCheckDestination('https://example.com/checkout', { timeoutMs: 20 })
    expect(result.outcome).toBe('timeout')
    expect(publicHttpCapacity.running).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
    settle(['93.184.216.34'])
    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
