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
import { openCheckDestination } from '../open-check'
import { publicLinkObservations } from '../checks/public-links'

vi.mock('node:dns/promises', () => ({ resolve4: async () => ['203.0.114.1'], resolve6: async () => [] }))

const url = 'http://example.com/', prefix = '<!doctype html><html><head><title>Partial page</title></head><body>'
const binary = Buffer.from([0, 255, 254, 128, 137, 80, 78, 71])
const missingPageDocuments = {
  'script-heading': '<script>window.fallback = "<h1>Page not found</h1>"</script>',
  'script-prose': '<script>window.status = "Page not found"</script>',
  'style-heading': '<style>body::after { content: "<h1>Page not found</h1>" }</style>',
  'template-heading': '<template><h1>Page not found</h1></template>',
  'noscript-heading': '<noscript><h1>Page not found</h1></noscript>',
  'comment-heading': '<!-- <h1>Page not found</h1> -->',
  'textarea-heading': '<textarea><h1>Page not found</h1></textarea>',
  'encoded-title': '<title>Page not&#32;found</title>',
  'encoded-heading': '<h1>Page not&#x20;found</h1>',
} as const
const server = createServer((request, response) => {
  if (request.url === '/bytes') { response.setHeader('content-type', 'application/octet-stream'); response.end(binary); return }
  if (request.url === '/') { response.writeHead(302, { location: url + 'body' }); response.end(); return }
  response.setHeader('content-type', 'text/html')
  if (request.url?.startsWith('/missing-content/')) {
    const key = request.url.slice('/missing-content/'.length) as keyof typeof missingPageDocuments
    response.end('<!doctype html><html><head></head><body>' + missingPageDocuments[key] +
      (key === 'textarea-heading' ? '' : '<h1>Useful details</h1>') + '<p>Our service details.</p></body></html>')
    return
  }
  if (request.url?.startsWith('/large-') || request.url?.startsWith('/login/large-')) {
    if (request.url === '/large-binary') response.setHeader('content-type', 'application/octet-stream')
    response.end(request.url === '/large-early-missing'
      ? '<title>Page not found</title>' + 'x'.repeat(1_050_000)
      : '<html><head><script>' + 'x'.repeat(1_050_000) + '</script></head><body><h1>' +
        (request.url.endsWith('/large-late-missing') ? 'Page not found' : 'Useful details') + '</h1></body></html>')
    return
  }
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'")
  if (request.url === '/gzip') { response.end(gzipSync('<urlset/>').subarray(0, 15)); return }
  if (request.url?.startsWith('/challenge-')) {
    response.statusCode = Number(request.url.split('-')[1])
    response.write('<html><head><title>Just a moment...</title></head><body>Checking your browser')
    setTimeout(() => response.destroy(), 20); return
  }
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
  it.each(['script-heading', 'script-prose', 'style-heading', 'template-heading', 'noscript-heading', 'comment-heading', 'textarea-heading'] as const)
  ('does not confuse %s with a missing-page document', async kind => {
    const result = await openCheckDestination(url + 'missing-content/' + kind)
    expect(result).toMatchObject({ status: 200, outcome: 'reachable', shouldFlagDead: false })
  })
  it.each(['encoded-title', 'encoded-heading'] as const)('recognizes published missing-page text in %s', async kind => {
    const result = await openCheckDestination(url + 'missing-content/' + kind)
    expect(result).toMatchObject({ status: 200, outcome: 'render_error', shouldFlagDead: true })
  })
  it.each(['large-normal', 'large-late-missing', 'login/large-late-missing'])('keeps an uninspected HTML remainder unknown for %s instead of certifying a repaired public link', async route => {
    const target = url + route
    const result = await openCheckDestination(target)
    expect(result).toMatchObject({ status: 200, outcome: 'unknown', shouldFlagDead: false })
    expect(publicLinkObservations(url, [target], [result])).toMatchObject({ complete: false, flags: [],
      assertions: [{ passed: false, complete: false }] })
  })
  it('retains a positively observed missing-page heading inside an incomplete prefix', async () => {
    const result = await openCheckDestination(url + 'large-early-missing')
    expect(result).toMatchObject({ status: 200, outcome: 'render_error', shouldFlagDead: true })
  })
  it.each(['large-normal', 'large-late-missing'])('keeps explicit HTTP-only reachability separate from content inspection for %s', async route => {
    expect(await openCheckDestination(url + route, { httpErrorsOnly: true }))
      .toMatchObject({ status: 200, outcome: 'reachable', shouldFlagDead: false })
  })
  it('does not apply HTML missing-page criteria to an observed binary resource', async () => {
    expect(await openCheckDestination(url + 'large-binary')).toMatchObject({ status: 200, outcome: 'reachable', shouldFlagDead: false })
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
