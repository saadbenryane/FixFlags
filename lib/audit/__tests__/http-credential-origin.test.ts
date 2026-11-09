import { createServer, type Server } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { safeFetchHtml, safeFetchDocument, PublicRequestError } from '../url'
import { PublicRedirectError } from '../redirect-evidence'
import { screenshotSnapshotSchema } from '../progressive/snapshots'
import { publicDocumentSchema } from '../search/contracts'

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return 'http://127.0.0.1:' + (server.address() as { port: number }).port
}
async function close(server: Server) {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

describe('HTTP evidence credential origin', () => {
  it('redacts legacy evidence fields while preserving the response facts used by checks', () => {
    const stored = {
      'Set-Cookie': 'session=legacy-fixture; HttpOnly',
      'www-authenticate': 'Basic realm="legacy-fixture"',
      'proxy-authenticate': '',
      'content-security-policy': "default-src 'self'",
      location: '/login',
    }
    const expected = {
      'set-cookie': '[redacted]',
      'www-authenticate': '[redacted]',
      'proxy-authenticate': '',
      'content-security-policy': "default-src 'self'",
      location: '/login',
    }
    expect(publicDocumentSchema.shape.headers.parse(stored)).toEqual(expected)
    expect(screenshotSnapshotSchema.shape.responseHeaders.parse(stored)).toEqual(expected)
  })

  it.each(['html', 'document'] as const)('preserves same-origin preview access and drops credentials across an origin redirect (%s)', async kind => {
    const external: Array<{ authorization?: string; cookie?: string; preview?: string }> = []
    let authenticated = 0
    const resource = createServer((request, response) => {
      external.push({ authorization: request.headers.authorization, cookie: request.headers.cookie,
        preview: request.headers['x-preview-token'] as string | undefined })
      response.setHeader('content-type', 'text/html'); response.end('<html><h1>Public destination</h1></html>')
    })
    const resourceUrl = await listen(resource)
    const owner = createServer((request, response) => {
      if (request.headers.authorization !== 'Bearer fixture-only' || request.headers.cookie !== 'fixture_session=value') {
        response.writeHead(401); response.end(); return
      }
      authenticated++
      response.writeHead(302, { location: request.url === '/start' ? '/landing' : resourceUrl + '/public',
        'set-cookie': 'fixture_session=replacement; Path=/' }); response.end()
    })
    const ownerUrl = await listen(owner)
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    try {
      const headers = { Authorization: 'Bearer fixture-only', Cookie: 'fixture_session=value', 'X-Preview-Token': 'fixture-token' }
      const result = await (kind === 'html' ? safeFetchHtml : safeFetchDocument)(ownerUrl + '/start', { headers })
      expect(result).toMatchObject({ finalUrl: resourceUrl + '/public', statusCode: 200 })
      expect('html' in result ? result.html : result.body).toBe('<html><h1>Public destination</h1></html>')
      expect(authenticated).toBe(2)
      expect(external).toEqual([{ authorization: undefined, cookie: undefined, preview: undefined }])
      expect(headers).toEqual({ Authorization: 'Bearer fixture-only', Cookie: 'fixture_session=value', 'X-Preview-Token': 'fixture-token' })
    } finally { vi.unstubAllEnvs(); await close(owner); await close(resource) }
  })

  it('carries response cookies within one origin and one request, respecting path, expiry, and Secure', async () => {
    const observed: Array<[string | undefined, string | undefined]> = []
    const server = createServer((request, response) => {
      observed.push([request.url, request.headers.cookie])
      if (request.url === '/start') {
        response.writeHead(302, { location: '/matching/step', 'set-cookie': [
          'visitor=allowed; Path=/; HttpOnly',
          'section=yes; Path=/matching',
          'expired=gone; Path=/; Expires=Wed, 01 Jan 2020 00:00:00 GMT',
          'secure=private; Path=/; Secure',
        ] }).end()
      } else if (request.url === '/matching/step') {
        response.writeHead(302, { location: '/landing' }).end()
      } else {
        response.writeHead(request.headers.cookie === 'visitor=allowed' ? 200 : 503, {
          'set-cookie': 'landing=private-fixture; Path=/; HttpOnly',
        }).end('Public response')
      }
    })
    const url = await listen(server)
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    try {
      expect(await safeFetchDocument(url + '/start')).toMatchObject({
        statusCode: 200, finalUrl: url + '/landing', headers: { 'set-cookie': '[redacted]' },
      })
      expect(await safeFetchDocument(url + '/landing')).toMatchObject({ statusCode: 503 })
      expect(observed).toEqual([
        ['/start', undefined], ['/matching/step', 'section=yes; visitor=allowed'],
        ['/landing', 'visitor=allowed'], ['/landing', undefined],
      ])
    } finally { vi.unstubAllEnvs(); await close(server) }
  })

  it('discards public response cookies at an origin change, even on the same hostname', async () => {
    const received: Array<string | undefined> = []
    const foreign = createServer((request, response) => { received.push(request.headers.cookie); response.end('Public response') })
    const foreignUrl = await listen(foreign)
    const issuer = createServer((request, response) => {
      received.push(request.headers.cookie)
      if (request.url === '/start') response.writeHead(302, { location: '/same', 'set-cookie': 'visitor=allowed; Path=/' }).end()
      else response.writeHead(302, { location: foreignUrl + '/landing' }).end()
    })
    const issuerUrl = await listen(issuer)
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    try {
      expect(await safeFetchDocument(issuerUrl + '/start')).toMatchObject({ statusCode: 200, finalUrl: foreignUrl + '/landing' })
      expect(received).toEqual([undefined, 'visitor=allowed', undefined])
    } finally { vi.unstubAllEnvs(); await close(issuer); await close(foreign) }
  })

  it('leaves an oversized redirect cookie header inconclusive without sending it', async () => {
    const visited: Array<string | undefined> = []
    const server = createServer((request, response) => {
      visited.push(request.url)
      response.writeHead(302, { location: '/landing',
        'set-cookie': ['a', 'b', 'c'].map(name => name + '=' + 'x'.repeat(3000) + '; Path=/') }).end()
    })
    const url = await listen(server)
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    try {
      const outcome = await safeFetchDocument(url + '/start').catch(error => error)
      expect(outcome).toBeInstanceOf(PublicRedirectError)
      expect(outcome).toMatchObject({ reason: 'redirect_limit',
        response: { statusCode: 302, finalUrl: url + '/start', headers: { 'set-cookie': '[redacted]' } } })
      expect(visited).toEqual(['/start'])
    } finally { vi.unstubAllEnvs(); await close(server) }
  })

  it('retains a stalled body as incomplete evidence after response headers arrive', async () => {
    let responseStarted = false
    const server = createServer((_request, response) => {
      responseStarted = true
      response.setHeader('content-type', 'text/html'); response.write('<html>')
    })
    const url = await listen(server)
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    try {
      await expect(safeFetchHtml(url, { timeoutMs: 1000 })).rejects.not.toBeInstanceOf(PublicRequestError)
      expect(responseStarted).toBe(true)
    }
    finally { vi.unstubAllEnvs(); await close(server) }
  })
})
