import { createServer } from 'node:http'
import { Agent } from 'undici'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { safeFetchDocument, safeFetchResource, safeFetchHtml, PublicRequestError } from '../url'
import { collectDocument } from '../search/collect'
import { publicDocumentSchema } from '../search/contracts'
import { collectionHandlers } from '../progressive/collectors'
import { httpArtifactSchema } from '../progressive/snapshots'
import { readArtifact } from '../progressive/contracts'
import type { TaskContext } from '../progressive/registry'
import { assessPageResponse } from '../checks/page-response'
import { probeUptime } from '@/lib/uptime/probe'
import { gzipSync } from 'node:zlib'
import { PublicResponseBodyError } from '../http-evidence'
import { parseMetadataIsolated, parseHttpNavigationIsolated } from '../progressive/cpu'
import { openCheckDestination } from '../open-check'
import { nativeHttpCollection } from '../native-http-evidence'
import { runAuthCheckoutChecks } from '../checks/auth-checkout'
import { runOgImageUrlCheck } from '../checks/metadata-checks'

vi.mock('node:dns/promises', async () => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture(({ resolve4: async () => ['203.0.114.1'], resolve6: async () => [] })))
vi.mock('@/lib/db', () => ({ prisma: { auditExecutionTask: { findMany: async () => [{ workKind: 'discovery', workInput: null }] } } }))

const url = 'http://example.com/', prefix = '<!doctype html><html><head><title>Partial page</title></head><body>'
const binary = Buffer.from([0, 255, 254, 128, 137, 80, 78, 71])
const navigationHtml = '<!doctype html><base href="/services/"><a href="pricing">Pricing</a><noscript><a href="contact">Contact</a></noscript>' +
  '<script type="application/ld+json">{"@type":"Product"}</script>'.repeat(51)
let navigationRequests = 0, responseRequests = 0
const server = createServer((request, response) => {
  responseRequests++
  if (request.url === '/bytes') { response.setHeader('content-type', 'application/octet-stream'); response.end(binary); return }
  if (request.url === '/') { response.writeHead(302, { location: url + 'body' }); response.end(); return }
  response.setHeader('content-type', 'text/html')
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'")
  if (request.url === '/navigation') { navigationRequests++; response.end(navigationHtml); return }
  if (request.url === '/reset') {
    response.write(prefix)
    setTimeout(() => request.socket.resetAndDestroy(), 20)
    return
  }
  if (request.url === '/gzip') { response.end(gzipSync('<urlset/>').subarray(0, 15)); return }
  if (request.url?.startsWith('/challenge-')) {
    response.statusCode = Number(request.url.split('-')[1])
    response.write('<html><head><title>Just a moment...</title></head><body>Checking your browser')
    setTimeout(() => response.destroy(), 20); return
  }
  if (request.url?.startsWith('/status-')) response.statusCode = Number(request.url.split('-')[1])
  response.write(prefix)
  if (request.url !== '/slow') setTimeout(() => response.destroy(), 20)
})
let transport = '', dispatcher: Agent
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  dispatcher = new Agent()
  const nativeFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (target.hostname !== 'example.com') throw new Error('External transport unavailable in this fixture')
    return nativeFetch(transport + target.pathname + target.search, { ...options, dispatcher } as RequestInit)
  })
})
afterAll(async () => {
  await dispatcher?.close(); server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
  vi.unstubAllGlobals()
})

describe('native HTTP body interruption evidence', () => {
  it.each([404, 503])('retains a known HTTP %s failure across uptime, page and destination interpretation', async status => {
    const target = url + 'status-' + status
    const collected = await collectDocument(target, Date.now() + 1500)
    expect(collected).toMatchObject({ status, complete: false, reason: 'response_body_unavailable' })
    expect(assessPageResponse(target, collected)).toMatchObject({ complete: true,
      flags: [{ checkId: 'page-http-error' }], assertions: [{ passed: false, complete: true }] })
    expect(await probeUptime(target)).toMatchObject({ result: 'FAILED', reason: 'response_error', statusCode: status, finalUrl: target })
    expect(await openCheckDestination(target)).toMatchObject({ shouldFlagDead: true, status,
      outcome: status === 404 ? 'not_found' : 'server_error' })
  })
  it.each([url + 'body', url + 'login'])('never certifies an interrupted successful destination at %s', async target => {
    expect(await openCheckDestination(target)).toMatchObject({ outcome: 'unknown', status: 200, shouldFlagDead: false })
  })
  it.each([200, 503])('retains an interrupted HTTP %s challenge as unknown for destinations and uptime', async status => {
    const target = url + 'challenge-' + status
    expect(await openCheckDestination(target)).toMatchObject({ outcome: 'blocked', status, shouldFlagDead: false })
    expect(await probeUptime(target)).toMatchObject({ result: 'UNKNOWN', reason: 'access_blocked', statusCode: status })
  })
  it('records interrupted destination and image failures once and replays their actual negative facts', async () => {
    const target = url + 'status-503', observed = nativeHttpCollection()
    const auth = () => runAuthCheckoutChecks(url, { links: [{ href: target, text: 'Subscribe', rel: null }] },
      observed.options)
    expect(await auth()).toMatchObject([{ checkId: 'checkout-link-dead' }])
    expect(await runOgImageUrlCheck(url, { ogImage: target })).toMatchObject([{ checkId: 'og-image-broken' }])
    expect(await runOgImageUrlCheck(url, { ogImage: target }, observed.options)).toMatchObject([{ checkId: 'og-image-broken' }])
    const snapshot = observed.snapshot(), replay = nativeHttpCollection(snapshot)
    const beforeReplay = responseRequests
    expect(snapshot.requests).toMatchObject([
      { kind: 'destination', result: { status: 503, shouldFlagDead: true } },
      { kind: 'document', result: { statusCode: 503, complete: false } },
    ])
    expect(await runAuthCheckoutChecks(url, { links: [{ href: target, text: 'Subscribe', rel: null }] }, replay.options))
      .toMatchObject([{ checkId: 'checkout-link-dead' }])
    expect(await runOgImageUrlCheck(url, { ogImage: target }, replay.options)).toMatchObject([{ checkId: 'og-image-broken' }])
    expect(replay.snapshot()).toEqual(snapshot)
    expect(responseRequests).toBe(beforeReplay)
  })
  it.each([401, 403, 429])('keeps interrupted HTTP %s access restrictions inconclusive across response consumers', async status => {
    const target = url + 'status-' + status
    expect(await probeUptime(target)).toMatchObject({ result: 'UNKNOWN', reason: status === 429 ? 'rate_limited' : 'access_blocked', statusCode: status })
    expect(await openCheckDestination(target)).toMatchObject({ shouldFlagDead: false, status })
    expect(assessPageResponse(target, await collectDocument(target, Date.now() + 1500))).toMatchObject({ complete: false, flags: [] })
    const scope: { complete?: boolean } = {}
    expect(await runOgImageUrlCheck(url, { ogImage: target }, { scope })).toEqual([])
    expect(scope.complete).toBe(false)
  })

  it('collects HTTP discovery links independently of unrelated metadata inventory limits', async () => {
    const target = url + 'navigation'
    expect(await parseMetadataIsolated(navigationHtml, target, Date.now() + 5000)).toBeNull()
    const artifact = await collectionHandlers.find(handler => handler.kind === 'http')!.evaluate({
      audit: { id: 'audit' }, task: { targetKey: 'task:p0:http' }, input: { pageUrl: target }, deadline: Date.now() + 5000,
    } as TaskContext)
    expect(artifact.data).toMatchObject({ metadata: null, navigation: { documentUrl: target, linkBaseUrl: url + 'services/', complete: true,
      links: [{ href: 'pricing', text: 'Pricing', rel: null }, { href: 'contact', text: 'Contact', rel: null }] } })
    expect(navigationRequests).toBe(1)
  })

  it('retains a bounded navigation inventory without certifying omitted destinations', async () => {
    const navigation = await parseHttpNavigationIsolated('<a href="/pricing">Pricing</a>'.repeat(10_001), url, Date.now() + 5000)
    expect(navigation.links).toHaveLength(10_000)
    expect(navigation.complete).toBe(false)
  })

  it('preserves original resource bytes and applies the shared response bound', async () => {
    const complete = await safeFetchResource(url + 'bytes')
    expect(complete.body).toEqual(binary)
    expect(complete).toMatchObject({ complete: true, finalUrl: url + 'bytes', statusCode: 200 })
    const limited = await safeFetchResource(url + 'bytes', { maxBytes: 4 })
    expect(limited.body).toEqual(binary.subarray(0, 4))
    expect(limited.complete).toBe(false)
  })

  it('retains the observed response and redirect while keeping partial page content unknown', async () => {
    const collected = publicDocumentSchema.parse(await collectDocument(url, Date.now() + 1500))
    expect(collected).toMatchObject({ url, finalUrl: url + 'body', status: 200, body: prefix, complete: false,
      reason: 'response_body_unavailable', redirects: [url], headers: { 'content-type': 'text/html' } })
    expect(assessPageResponse(url, collected)).toMatchObject({ complete: false, flags: [], assertions: [{ complete: false, passed: false }] })
  })
  it('completes the HTTP task with existing response facts instead of retrying missing evidence', async () => {
    const artifact = await collectionHandlers.find(handler => handler.kind === 'http')!.evaluate({
      input: { pageUrl: url }, deadline: Date.now() + 1500,
    } as TaskContext)
    expect(httpArtifactSchema.parse(readArtifact(artifact, 'http').data)).toMatchObject({ metadata: null,
      document: { status: 200, complete: false, reason: 'response_body_unavailable' } })
    expect(artifact.data.navigation).toBeUndefined()
  })
  it('retains response facts when the execution deadline interrupts body collection', async () => {
    const collected = await collectDocument(url + 'slow', Date.now() + 150)
    expect(collected).toMatchObject({ status: 200, complete: false, body: prefix, reason: 'response_body_unavailable' })
    expect(await safeFetchDocument(url + 'slow', { timeoutMs: 50 }).catch(error => error instanceof PublicRequestError)).toBe(false)
    await expect(safeFetchHtml(url + 'slow', { timeoutMs: 50 })).rejects.toBeDefined()
  })
  it('does not turn a failed body into a successful uptime observation', async () => {
    expect(await probeUptime(url)).toMatchObject({ result: 'UNKNOWN', reason: 'probe_unavailable', statusCode: 200, finalUrl: url + 'body' })
  })
  it('keeps a native connection reset after response headers inconclusive for uptime', async () => {
    const target = url + 'reset'
    const error = await safeFetchDocument(target).catch(error => error)
    expect(error).toBeInstanceOf(PublicResponseBodyError)
    expect(error.response).toMatchObject({ statusCode: 200, body: prefix, complete: false, finalUrl: target })
    expect(await probeUptime(target)).toMatchObject({ result: 'UNKNOWN', statusCode: 200, finalUrl: target })
  })
  it.each([200, 503])('retains access-challenge refusal on an interrupted HTTP %s body', async status => {
    const target = url + 'challenge-' + status
    const collected = await collectDocument(target, Date.now() + 1500)
    expect(collected).toMatchObject({ status, complete: false, reason: 'public_access_challenge' })
    expect(assessPageResponse(target, collected)).toMatchObject({ complete: false, flags: [] })
  })
  it('retains headers but never promotes corrupt compressed bytes into inspected content', async () => {
    expect(await collectDocument(url + 'gzip', Date.now() + 1500)).toMatchObject({ status: 200, complete: false,
      body: null, reason: 'response_body_unavailable', headers: { 'content-type': 'text/html' } })
  })
})
