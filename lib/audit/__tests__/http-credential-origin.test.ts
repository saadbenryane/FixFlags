import { createServer, type Server } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { safeFetchHtml, safeFetchDocument, PublicRequestError } from '../url'

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return 'http://127.0.0.1:' + (server.address() as { port: number }).port
}
async function close(server: Server) {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

describe('HTTP evidence credential origin', () => {
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
      response.writeHead(302, { location: request.url === '/start' ? '/landing' : resourceUrl + '/public' }); response.end()
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
