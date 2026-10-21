import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { safeFetchDocument } from '../url'
import { collectDocument } from '../search/collect'
import { publicDocumentSchema } from '../search/contracts'
import { assessPageResponse } from '../checks/page-response'
import { probeUptime } from '@/lib/uptime/probe'
import { classifyPublicRequestFailure } from '../http-failure'
import { openCheckDestination } from '../open-check'
import { publicLinkObservations } from '../checks/public-links'
import { runAuthCheckoutChecks } from '../checks/auth-checkout'
import { parseMetadataFromHtml } from '../metadata'
import { assessSecurityTransport } from '../checks/security'

vi.mock('node:dns/promises', () => ({ resolve4: async () => ['203.0.114.1'], resolve6: async () => [] }))
const origin = 'https://example.com', requests: string[] = []
const server = createServer((request, response) => {
  const path = new URL(request.url!, origin)
  requests.push(path.href)
  response.statusCode = 302
  if (path.pathname.startsWith('/nonredirect') || path.pathname === '/mixed-a') response.statusCode = 304
  if (path.pathname.startsWith('/chain/')) response.setHeader('location', '/chain/' + (Number(path.pathname.split('/').at(-1)) + 1))
  else if (path.pathname === '/unsafe') response.setHeader('location', 'http://127.0.0.1/private')
  else if (path.pathname === '/self') response.setHeader('location', '#section')
  else {
    if (path.pathname === '/cookie-a') response.setHeader('set-cookie', 'visitor=allowed; Path=/')
    if (path.pathname === '/challenge-a') response.setHeader('cf-mitigated', 'challenge')
    response.setHeader('location', path.pathname.endsWith('-a') ? path.pathname.slice(0, -1) + 'b' + path.search : path.pathname.slice(0, -1) + 'a' + path.search)
  }
  response.end()
})
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port, nativeFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.origin !== origin) throw new Error('External transport unavailable in this fixture')
    return nativeFetch(transport + url.pathname + url.search, options)
  })
})
afterAll(async () => {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
  vi.unstubAllGlobals()
})
describe('observed public redirect failures', () => {
  it.each(['/loop-a?token=PRIVATE_VALUE', '/self'])('retains a repeated routing cycle as failure evidence: %s', async path => {
    const url = origin + path, start = requests.length
    const page = await collectDocument(url, Date.now() + 10_000)
    expect(page).toMatchObject({ status: 302, complete: false, body: null, reason: 'redirect_loop' })
    expect(publicDocumentSchema.safeParse(page).success).toBe(true)
    const security = assessSecurityTransport(url, null, page)
    expect(security.assertions.find(assertion => assertion.key === 'tls-certificate'))
      .toMatchObject({ passed: false, complete: false })
    expect(requests.length - start).toBe(6)
    const checked = assessPageResponse(url, page)
    expect(checked).toMatchObject({ complete: true, assertions: [{ complete: true, passed: false }],
      flags: [{ checkId: 'page-redirect-loop', pageUrl: url }] })
    expect(JSON.stringify({ assertions: checked.assertions, problem: checked.flags[0].problem,
      evidence: checked.flags[0].evidence, targets: checked.flags[0].evidenceTargets })).not.toContain('PRIVATE_VALUE')
    expect(await probeUptime(url)).toMatchObject({ result: 'FAILED', reason: 'redirect_loop', statusCode: 302 })
    const opened = await openCheckDestination(url)
    expect(opened).toMatchObject({ outcome: 'redirect_loop', status: 302, shouldFlagDead: true })
    expect(publicLinkObservations(origin, [url], [opened])).toMatchObject({ complete: true,
      flags: [{ checkId: 'broken-internal-links' }] })
  })
  it.each(['/chain/0', '/cookie-a', '/challenge-a', '/unsafe', '/nonredirect-a', '/mixed-a'])
    ('does not infer an outage from an unobserved ending or client-state routing: %s', async path => {
      const url = origin + path
      const page = await collectDocument(url, Date.now() + 10_000)
      expect(page.complete).toBe(false)
      if (path === '/chain/0') expect(assessSecurityTransport(url, null, page).assertions.find(assertion => assertion.key === 'tls-certificate'))
        .toMatchObject({ passed: false, complete: false })
      expect(assessPageResponse(url, page)).toMatchObject({ flags: [], complete: false })
      expect(await probeUptime(url)).toMatchObject({ result: 'UNKNOWN' })
      expect(await openCheckDestination(url)).toMatchObject({ shouldFlagDead: false })
    })
  it('does not recognize failure from error message text alone', () => {
    expect(classifyPublicRequestFailure(new Error('Redirect loop'))).toMatchObject({ result: 'UNKNOWN' })
  })
  it('flags a looping sign-in destination using the same bounded public collector', async () => {
    const metadata = parseMetadataFromHtml('<a href="/loop-a">Sign in</a>', origin)
    expect(await runAuthCheckoutChecks(origin, metadata)).toMatchObject([{ checkId: 'auth-page-broken' }])
  })
  it('retains the existing explicit redirect limit', async () => {
    const start = requests.length
    await expect(safeFetchDocument(origin + '/loop-a', { maxRedirects: 2 })).rejects.toThrow()
    expect(requests.length - start).toBe(3)
  })
})
