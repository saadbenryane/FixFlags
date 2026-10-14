import { createServer, type Server } from 'node:http'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { createAuditPage } from './page-session'
import { DESKTOP_CAPTURE_PROFILE } from './capture-profile'
import { scanAccessToFetchHeaders } from '../scan-access'
import { fetchAndParseMetadata } from '../metadata'
import { runDestinationUXProbes } from '../flow/destination-ux-probes'
import { primaryPageContext } from '../flow/primary-action-evidence'
import { auditPageObservation } from './observation-scope'
import { probeFormValidation } from '../flow/form-probes'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
async function close(server: Server) { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
run('native saved credential scope', () => {
  afterAll(closeBrowser)
  it('authenticates only the approved origin and does not rebind defaults or derived HTTP probes to a foreign page', async () => {
    let rootBasic = false, rootHeader = false, rootCookie = false, leaked = false, approved = ''
    const html = '<html><head><title>Useful website information</title></head><body><main><h1>Useful website information</h1><p>Read useful information about our service.</p><form><input name="email" required><button type="submit">Subscribe</button></form></main></body></html>'
    const owner = createServer((request, response) => {
      rootHeader ||= request.headers['x-preview'] === 'PRIVATE_HEADER'
      rootCookie ||= request.headers.cookie?.includes('preview=PRIVATE_COOKIE') === true
      rootBasic ||= request.headers.authorization === 'Basic ' + Buffer.from('owner:PRIVATE_PASSWORD').toString('base64')
      if (!request.headers.authorization) { response.writeHead(401, { 'www-authenticate': 'Basic realm="Fixture"' }); response.end('Authentication required'); return }
      response.setHeader('content-type', 'text/html'); response.end(html)
    })
    const foreign = createServer((request, response) => {
      leaked ||= Boolean(request.headers.authorization || request.headers['x-preview'] || request.headers.cookie?.includes('PRIVATE_COOKIE'))
      if (request.url === '/return-approved') { response.writeHead(302, { location: approved }); response.end(); return }
      if (request.url === '/challenge') { response.writeHead(401, { 'www-authenticate': 'Basic realm="Fixture"' }); response.end(); return }
      response.setHeader('content-type', 'text/html'); response.end(html)
    })
    await new Promise<void>((resolve, reject) => { owner.once('error', reject); owner.listen(0, '127.0.0.1', resolve) })
    await new Promise<void>((resolve, reject) => { foreign.once('error', reject); foreign.listen(0, '127.0.0.1', resolve) })
    approved = 'http://localhost:' + (owner.address() as { port: number }).port
    const other = 'http://127.0.0.1:' + (foreign.address() as { port: number }).port
    const config = { origin: approved, httpBasic: { username: 'owner', password: 'PRIVATE_PASSWORD' },
      headers: { 'X-Preview': 'PRIVATE_HEADER' }, cookies: [{ name: 'preview', value: 'PRIVATE_COOKIE' }] }
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', '11'.repeat(32))
    try {
      const first = await createAuditPage(await getAuditBrowser(), approved, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, scanAccess: config, deadline: Date.now() + 10_000 })
      const beforeAction = primaryPageContext(approved, first.page.url(), first.page.viewportSize(), auditPageObservation(first.page)?.scope)
      const beforeForm = (await probeFormValidation(first.page)).evidence?.context
      first.disposeNetwork(); await first.page.context().close()
      expect(rootBasic && rootHeader && rootCookie).toBe(true)
      const changed = await createAuditPage(await getAuditBrowser(), approved, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true,
        scanAccess: { ...config, headers: { 'X-Preview': 'CHANGED_ACCESS' } }, deadline: Date.now() + 10_000 })
      try {
        expect(primaryPageContext(approved, changed.page.url(), changed.page.viewportSize(), auditPageObservation(changed.page)?.scope)).not.toBe(beforeAction)
        expect((await probeFormValidation(changed.page)).evidence?.context).not.toBe(beforeForm)
      } finally { changed.disposeNetwork(); await changed.page.context().close() }
      const second = await createAuditPage(await getAuditBrowser(), other, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, scanAccess: config, deadline: Date.now() + 15_000 })
      try {
        await fetchAndParseMetadata(other, { headers: scanAccessToFetchHeaders(config, other) })
        await runDestinationUXProbes(second.page, 'Get started', other, config)
        expect(leaked).toBe(false)
      } finally { second.disposeNetwork(); await second.page.context().close() }
      await expect(createAuditPage(await getAuditBrowser(), other + '/challenge', { profile: DESKTOP_CAPTURE_PROFILE,
        allowLocalhost: true, scanAccess: config, deadline: Date.now() + 10_000 })).rejects.toThrow()
      expect(leaked).toBe(false)
      rootBasic = false; rootHeader = false; rootCookie = false
      const redirected = await createAuditPage(await getAuditBrowser(), other + '/return-approved', { profile: DESKTOP_CAPTURE_PROFILE,
        allowLocalhost: true, scanAccess: config, deadline: Date.now() + 10_000 })
      try {
        expect(redirected.page.url()).toBe(approved + '/')
        expect(rootBasic && rootHeader && rootCookie).toBe(true)
        expect(leaked).toBe(false)
      } finally { redirected.disposeNetwork(); await redirected.page.context().close() }
    } finally { vi.unstubAllEnvs(); await close(owner); await close(foreign) }
  }, 30_000)
})
