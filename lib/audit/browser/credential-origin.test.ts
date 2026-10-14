import { createServer, type Server } from 'node:http'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { createAuditPage } from './page-session'
import { DESKTOP_CAPTURE_PROFILE } from './capture-profile'
import * as publicTargets from '../url'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return 'http://127.0.0.1:' + (server.address() as { port: number }).port
}
async function close(server: Server) {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

run('native preview credential origin', () => {
  afterAll(closeBrowser)
  it('keeps worker rendering functional while scoping headers and refusing worker mutations', async () => {
    let leaked = false, protectedHits = 0, workerHeader = false
    const resource = createServer((request, response) => {
      leaked ||= Boolean(request.headers['x-preview-token'])
      response.setHeader('access-control-allow-origin', '*'); response.end('Public resource')
    })
    const resourceUrl = await listen(resource)
    let ownerUrl = ''
    const owner = createServer((request, response) => {
      if (request.url === '/data') {
        workerHeader = request.headers['x-preview-token'] === 'fixture-worker-token'
        response.writeHead(302, { location: resourceUrl + '/resource' }); response.end(); return
      }
      if (request.url === '/protected') { protectedHits++; response.end('Mutation accepted'); return }
      if (request.url === '/worker.js') {
        response.setHeader('content-type', 'application/javascript')
        response.end('Promise.all([fetch(' + JSON.stringify(ownerUrl + '/data') + ').then(r=>r.text()),fetch(' +
          JSON.stringify(ownerUrl + '/protected') + ',{method:"POST",body:"fixture-only"}).then(()=>false,()=>true)]).then(v=>postMessage(v[0]+":"+v[1]))')
        return
      }
      response.setHeader('content-type', 'text/html')
      response.end('<html><body><h1>Worker fixture</h1><script>const w=new Worker("/worker.js");w.onmessage=e=>document.body.dataset.worker=e.data</script></body></html>')
    })
    ownerUrl = await listen(owner)
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), ownerUrl, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true,
        journeySafe: true, scanAccess: { headers: { 'X-Preview-Token': 'fixture-worker-token' } }, deadline: Date.now() + 10_000 })
      await session.page.waitForFunction(() => document.body.dataset.worker === 'Public resource:true', undefined, { timeout: 5000 })
      expect(workerHeader).toBe(true)
      expect(leaked).toBe(false)
      expect(protectedHits).toBe(0)
    } finally { session?.disposeNetwork(); await session?.page.context().close(); await close(owner); await close(resource) }
  }, 20_000)

  it.each([false, true])('retains the real redirected telemetry scope without delivery (embedded: %s)', async embedded => {
    let delivered = 0
    const server = createServer((request, response) => {
      if (request.url === '/beacon-entry') {
        response.writeHead(302, { location: '/_vercel/insights/view?cid=PRIVATE_CID' }); response.end(); return
      }
      if (request.url?.startsWith('/_vercel/insights/view')) { delivered++; response.end('Event accepted'); return }
      response.setHeader('content-type', 'text/html')
      response.end('<html><body><h1>Public telemetry fixture</h1>' +
        (embedded && request.url !== '/embedded' ? '<iframe src="/embedded"></iframe>' : '<img src="/beacon-entry">') + '</body></html>')
    })
    const url = await listen(server)
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), url, { profile: DESKTOP_CAPTURE_PROFILE,
        allowLocalhost: true, deadline: Date.now() + 10_000 })
      const events = session.tracking().requests.filter(request => request.role === 'event')
      expect(events).toHaveLength(embedded ? 0 : 1)
      if (!embedded) expect(events[0]).toMatchObject({ state: 'suppressed', reason: 'scanner_suppressed' })
      expect(delivered).toBe(0)
      expect(JSON.stringify(session.tracking())).not.toContain('PRIVATE_CID')
    } finally { session?.disposeNetwork(); await session?.page.context().close(); await close(server) }
  }, 20_000)

  it('awaits public-target validation before a redirected request can reach a private server', async () => {
    let hits = 0, inspected = false
    const privateServer = createServer((_request, response) => { hits++; response.end('Private data') })
    const privateUrl = await listen(privateServer)
    const original = publicTargets.assertPublicAuditUrl
    const validation = vi.spyOn(publicTargets, 'assertPublicAuditUrl').mockImplementation(async (...args) => {
      if (args[0].startsWith(privateUrl)) { inspected = true; await new Promise(resolve => setTimeout(resolve, 50)) }
      return original(...args)
    })
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'false')
    try {
      await expect(createAuditPage(await getAuditBrowser(), 'https://example.com/entry', {
        profile: DESKTOP_CAPTURE_PROFILE, deadline: Date.now() + 10_000,
        configurePage: async page => { await page.route('https://example.com/**', route => route.fulfill({ status: 302,
          headers: { location: privateUrl + '/private' } })) },
      })).rejects.toThrow()
      expect(inspected).toBe(true)
      expect(hits).toBe(0)
    } finally { validation.mockRestore(); vi.unstubAllEnvs(); await close(privateServer) }
  }, 20_000)

  it('applies redirect target validation inside a cross-site embedded document', async () => {
    let hits = 0, inspected = false
    const server = createServer((_request, response) => { hits++; response.end('Private data') })
    const privateUrl = await listen(server), original = publicTargets.assertPublicAuditUrl
    const validation = vi.spyOn(publicTargets, 'assertPublicAuditUrl').mockImplementation(async (...args) => {
      if (args[0].startsWith(privateUrl)) { inspected = true; await new Promise(resolve => setTimeout(resolve, 50)) }
      return original(...args)
    })
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'false')
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), 'http://example.com/entry', { profile: DESKTOP_CAPTURE_PROFILE,
        deadline: Date.now() + 10_000, configurePage: async page => {
          await page.route('http://example.com/**', route => route.fulfill({ contentType: 'text/html',
            body: '<html><body><h1>Public host</h1><iframe src="http://example.net/embedded"></iframe></body></html>' }))
          await page.route('http://example.net/**', route => route.request().url().endsWith('/relay')
            ? route.fulfill({ status: 302, headers: { location: privateUrl + '/private' } })
            : route.fulfill({ contentType: 'text/html', body: '<html><body><img src="/relay"></body></html>' }))
        } })
      expect(await session.page.locator('h1').innerText()).toBe('Public host')
      expect(inspected).toBe(true)
      expect(hits).toBe(0)
    } finally {
      session?.disposeNetwork(); await session?.page.context().close()
      validation.mockRestore(); vi.unstubAllEnvs(); await close(server)
    }
  }, 20_000)

  it('allows one authorized cart request and refuses its redirected cross-origin POST', async () => {
    let cartHits = 0, protectedHits = 0
    const protectedServer = createServer((request, response) => {
      if (request.method === 'POST') protectedHits++
      response.setHeader('access-control-allow-origin', '*'); response.end('Protected response')
    })
    const protectedUrl = await listen(protectedServer)
    const cartServer = createServer((request, response) => {
      if (request.url === '/cart/add') {
        cartHits++; response.writeHead(307, { location: protectedUrl + '/protected' }); response.end(); return
      }
      response.setHeader('content-type', 'text/html'); response.end('<html><body><h1>Public cart entry</h1></body></html>')
    })
    const cartUrl = await listen(cartServer)
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), cartUrl, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true,
        buyPath: true, deadline: Date.now() + 10_000 })
      const accepted = await session.page.evaluate(() => fetch('/cart/add', { method: 'POST', body: 'fixture-cart-item' }).then(() => true, () => false))
      expect(accepted).toBe(false)
      expect(cartHits).toBe(1)
      expect(protectedHits).toBe(0)
      expect(session.safetyRestrictions).toContain('protected_action_requires_fixture')
    } finally {
      session?.disposeNetwork(); await session?.page.context().close()
      await close(cartServer); await close(protectedServer)
    }
  }, 20_000)

  it('authenticates the configured origin without forwarding preview credentials to a resource origin', async () => {
    const basic = 'Basic ' + Buffer.from('preview:fixture-password').toString('base64')
    const external: Array<{ url?: string; authorization?: string; preview?: string; accept?: string }> = []
    const owned: Array<{ authorization?: string; preview?: string }> = []
    const resource = createServer((request, response) => {
      external.push({ url: request.url, authorization: request.headers.authorization, preview: request.headers['x-preview-token'] as string | undefined,
        accept: request.headers.accept })
      response.writeHead(401, { 'www-authenticate': 'Basic realm="resource"' }); response.end()
    })
    const resourceUrl = await listen(resource)
    const owner = createServer((request, response) => {
      owned.push({ authorization: request.headers.authorization, preview: request.headers['x-preview-token'] as string | undefined })
      if (request.headers.authorization !== basic || request.headers['x-preview-token'] !== 'fixture-token') {
        response.writeHead(401, { 'www-authenticate': 'Basic realm="owner"' }); response.end(); return
      }
      if (request.url === '/start') {
        response.writeHead(302, { location: '/landing' }); response.end(); return
      }
      if (request.url === '/redirect') {
        response.writeHead(302, { location: resourceUrl + '/redirected-resource' }); response.end(); return
      }
      response.setHeader('content-type', 'text/html')
      response.end('<!doctype html><html><body><h1>Private preview content</h1><img src="' + resourceUrl + '/resource"><img src="/redirect"></body></html>')
    })
    const ownerUrl = await listen(owner)
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), ownerUrl + '/start', { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true,
        scanAccess: { httpBasic: { username: 'preview', password: 'fixture-password' },
          headers: { 'X-Preview-Token': 'fixture-token', Accept: 'application/private-preview' } },
        deadline: Date.now() + 10_000 })
      expect(await session.page.locator('h1').innerText()).toBe('Private preview content')
      expect(session.page.url()).toBe(ownerUrl + '/landing')
      expect(owned.some(request => request.authorization === basic && request.preview === 'fixture-token')).toBe(true)
      expect(external.length).toBeGreaterThan(0)
      expect(external.some(request => request.url === '/redirected-resource')).toBe(true)
      expect(external.every(request => !request.authorization && !request.preview)).toBe(true)
      expect(external.every(request => request.accept && request.accept !== 'application/private-preview')).toBe(true)
    } finally {
      session?.disposeNetwork()
      await session?.page.context().close()
      await close(owner); await close(resource)
    }
  }, 20_000)
})
