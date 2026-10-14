import { createServer, type Server } from 'node:http'
import { AsyncLocalStorage } from 'node:async_hooks'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { createAuditPage } from './page-session'
import { DESKTOP_CAPTURE_PROFILE } from './capture-profile'
import { safeFormRequestAllowed } from './safe-form-safety'
import { openAccountBrowser } from '@/lib/sites/accounts/browser'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  return 'http://127.0.0.1:' + (server.address() as { port: number }).port
}
async function close(server: Server) {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}
run('native privileged request policies', () => {
  afterAll(closeBrowser)
  it('retains rendered errors only for opted-in account inspection and still refuses bot challenges', async () => {
    let challenged = false
    const server = createServer((_request, response) => {
      response.writeHead(503, { 'content-type': 'text/html', ...(challenged ? { 'cf-mitigated': 'challenge' } : {}) })
      response.end('<html><head><title>Account service</title></head><body><h1>Account service</h1><button>Sign out</button></body></html>')
    })
    const url = await listen(server)
    try {
      const browser = await getAuditBrowser()
      await expect(createAuditPage(browser, url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false }))
        .rejects.toMatchObject({ code: 'HTTP_ERROR', httpStatus: 503 })
      const session = await createAuditPage(browser, url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false, retainErrorDocument: true })
      try { expect(session.httpStatus).toBe(503); expect(await session.page.getByRole('button', { name: 'Sign out' }).isVisible()).toBe(true) }
      finally { session.disposeNetwork(); await session.page.context().close() }
      challenged = true
      await expect(createAuditPage(browser, url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false, retainErrorDocument: true }))
        .rejects.toMatchObject({ code: 'HTTP_FORBIDDEN', httpStatus: 503 })
    } finally { await close(server) }
  })
  it.each(['account', 'fixture'] as const)('preserves one allowed submission and refuses redirected external effects for %s', async kind => {
    const email = 'disposable@fixture.test'
    let foreignHits = 0, submissions = 0, invitations = 0, telemetry = 0, mode = 'success'
    const foreign = createServer((_request, response) => { foreignHits++; response.end('External request arrived') })
    const other = await listen(foreign)
    const owner = createServer((request, response) => {
      if (request.url === '/_vercel/insights/view') { telemetry++; response.end('Event accepted'); return }
      if (request.url === '/api/signup') {
        submissions++
        response.writeHead(mode === 'success' ? 303 : 307, { location: mode === 'success' ? '/dashboard'
          : mode === 'invite' ? '/api/invite' : other + '/receive' })
        response.end(); return
      }
      if (request.url === '/api/invite') { invitations++; response.end('Invitation created'); return }
      response.setHeader('content-type', 'text/html')
      response.end(request.url === '/dashboard' ? '<html><body><h1>Completed</h1></body></html>'
        : '<html><body><form action="/api/signup" method="post"><label>Email<input name="email" type="email"></label><button type="submit">Create account</button></form><script>fetch("/_vercel/insights/view",{method:"POST",body:"fixture-event"}).catch(()=>{})</script></body></html>')
    })
    const origin = await listen(owner)
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    const requestContext = new AsyncLocalStorage<string>()
    try {
      for (mode of ['success', 'external', ...(kind === 'account' ? ['invite', 'paused'] : [])]) {
        const permission = vi.fn(async () => {
          expect(requestContext.getStore()).toBe('admitted-execution')
          if (mode === 'paused') throw new Error('Account permission was revoked')
        })
        let refused = false
        const account = kind === 'account' ? await requestContext.run('admitted-execution', () => openAccountBrowser({ url: origin + '/signup', origin, values: [email],
          deadline: Date.now() + 10_000, permission })) : null
        const session = account?.session ?? await requestContext.run('admitted-execution', async () => createAuditPage(await getAuditBrowser(), origin + '/signup', {
          profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false, deadline: Date.now() + 10_000,
          requestPolicy: async request => {
            expect(requestContext.getStore()).toBe('admitted-execution')
            const allowed = safeFormRequestAllowed({ ...request, origin, values: [email] })
            refused ||= !allowed
            return allowed
          },
        }))
        try {
          await session.page.getByLabel('Email').fill(email)
          account?.mutation('signup', origin + '/api/signup')
          await session.page.getByRole('button', { name: 'Create account' }).click().catch(() => undefined)
          if (mode === 'success') {
            await session.page.getByRole('heading', { name: 'Completed' }).waitFor({ timeout: 5000 })
            expect(account?.refused() ?? refused).toBe(false)
          } else {
            await vi.waitFor(() => expect(account?.refused() ?? refused).toBe(true), { timeout: 5000 })
          }
          if (account) expect(permission).toHaveBeenCalled()
        } finally {
          if (account) await account.closed()
          else { session.disposeNetwork(); await session.page.context().close() }
        }
      }
      expect(submissions).toBe(kind === 'account' ? 3 : 2)
      expect(foreignHits).toBe(0)
      expect(invitations).toBe(0)
      expect(telemetry).toBe(0)
    } finally { vi.unstubAllEnvs(); await close(owner); await close(foreign) }
  }, 45_000)
})
