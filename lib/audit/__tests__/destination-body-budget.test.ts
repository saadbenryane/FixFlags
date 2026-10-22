import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { Agent } from 'undici'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { openCheckDestination } from '../open-check'
import { publicLinkObservations } from '../checks/public-links'
import { safeFetchDocument } from '../url'

vi.mock('node:dns/promises', () => ({ resolve4: async () => ['203.0.114.1'], resolve6: async () => [] }))

const origin = 'http://example.com/'
const recordedSites = new Map(['fixflags-com.html', 'stripe-com.html', 'github-com.html'].map(name =>
  [name, readFileSync(new URL('./fixtures/sites/' + name, import.meta.url))]))
const body = (missing: boolean, bytes = 100_000) => '<!doctype html><html><head><script>' + 'x'.repeat(bytes) +
  '</script></head><body><h1>' + (missing ? 'Page not found' : 'Useful details') + '</h1></body></html>'
const closed = new Map<string, boolean>()
const server = createServer((request, response) => {
  const path = request.url ?? '/'
  response.setHeader('content-type', 'text/html')
  if (path === '/redirect-large') {
    response.writeHead(302, { location: origin + 'large-missing', 'content-type': 'application/octet-stream' })
    response.end(); return
  }
  const recorded = recordedSites.get(path.slice(1))
  if (recorded) { response.end(recorded); return }
  if (path.startsWith('/bounded-')) {
    response.statusCode = path === '/bounded-error' ? 503 : 200
    if (path === '/bounded-binary') response.setHeader('content-type', 'application/octet-stream')
    if (path === '/bounded-challenge') response.setHeader('cf-mitigated', 'challenge')
    response.on('close', () => closed.set(path, response.writableEnded))
    response.write('<!doctype html><html><head><script>' + 'x'.repeat(25_000))
    // The server never finishes this response. A response-specific byte bound
    // must release its connection instead of waiting for a body or task timeout.
    return
  }
  response.end(body(path.includes('missing'), path.startsWith('/oversized') ? 1_050_000 : 100_000))
})
let dispatcher: Agent, transport: string
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  dispatcher = new Agent()
  const nativeFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.hostname !== 'example.com') throw new Error('External transport unavailable in this fixture')
    return nativeFetch(transport + url.pathname, { ...options, dispatcher } as RequestInit)
  })
})
afterAll(async () => {
  await dispatcher?.close(); server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
  vi.unstubAllGlobals()
})

describe('native public destination response budgets', () => {
  it.each([...recordedSites.keys()])('inspects the complete existing %s fixture rather than losing ordinary content after 20 KB', async name => {
    expect(await openCheckDestination(origin + name)).toMatchObject({ status: 200, outcome: 'reachable', shouldFlagDead: false })
  })
  it('establishes a complete useful response after a large script prefix', async () => {
    const target = origin + 'large-healthy', result = await openCheckDestination(target)
    expect(result).toMatchObject({ status: 200, outcome: 'reachable', shouldFlagDead: false })
    expect(publicLinkObservations(origin, [target], [result])).toMatchObject({ complete: true, flags: [],
      assertions: [{ complete: true, passed: true }] })
  })
  it.each(['large-missing', 'login/large-missing'])('detects the actual missing-page heading after a large script prefix at %s', async path => {
    const target = origin + path, result = await openCheckDestination(target)
    expect(result).toMatchObject({ status: 200, outcome: 'render_error', shouldFlagDead: true })
    expect(publicLinkObservations(origin, [target], [result])).toMatchObject({ complete: true,
      assertions: [{ complete: true, passed: false }] })
  })
  it('selects the final HTML response budget after following a redirect', async () => {
    expect(await openCheckDestination(origin + 'redirect-large')).toMatchObject({ status: 200,
      finalUrl: origin + 'large-missing', outcome: 'render_error', shouldFlagDead: true })
  })
  it.each(['oversized-healthy', 'oversized-missing'])('keeps uninspected content beyond the standard document bound unknown at %s', async path => {
    const target = origin + path, result = await openCheckDestination(target)
    expect(result).toMatchObject({ status: 200, outcome: 'unknown', shouldFlagDead: false })
    expect(publicLinkObservations(origin, [target], [result])).toMatchObject({ complete: false, flags: [],
      assertions: [{ complete: false, passed: false }] })
  })
  it.each([
    { path: 'bounded-http', httpErrorsOnly: true, outcome: 'reachable', shouldFlagDead: false, status: 200 },
    { path: 'bounded-binary', httpErrorsOnly: false, outcome: 'reachable', shouldFlagDead: false, status: 200 },
    { path: 'bounded-error', httpErrorsOnly: false, outcome: 'server_error', shouldFlagDead: true, status: 503 },
    { path: 'bounded-challenge', httpErrorsOnly: false, outcome: 'blocked', shouldFlagDead: false, status: 200 },
  ])('retains prompt prefix cancellation for $path', async ({ path, httpErrorsOnly, ...expected }) => {
    expect(await openCheckDestination(origin + path, { httpErrorsOnly, timeoutMs: 500 })).toMatchObject(expected)
    await vi.waitFor(() => expect(closed.get('/' + path)).toBe(false), { timeout: 1000, interval: 10 })
  })
  it('cancels an unusable response budget and releases transport ownership for subsequent collection', async () => {
    await expect(safeFetchDocument(origin + 'bounded-invalid', { maxBytes: () => NaN }))
      .rejects.toThrow('Invalid public response body limit')
    await vi.waitFor(() => expect(closed.get('/bounded-invalid')).toBe(false), { timeout: 1000, interval: 10 })
    expect(await openCheckDestination(origin + 'large-healthy')).toMatchObject({ outcome: 'reachable', shouldFlagDead: false })
  })
})
