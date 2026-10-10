/** Opt-in, local-only transport fixture. Production code has no fixture switch. */
import { loadEnvConfig } from '@next/env'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import Redis from 'ioredis'
import { chromium } from 'playwright'

async function main() {
loadEnvConfig(process.cwd())
if (process.env.FIXFLAGS_LOCAL_RELIABILITY_PROOF !== '1') throw new Error('Explicit opt-in required')
for (const key of ['DATABASE_URL', 'REDIS_URL']) {
  if (!process.env[key] || !['localhost', '127.0.0.1'].includes(new URL(process.env[key]!).hostname)) throw new Error(`Local ${key} required`)
}
const redisUrl = new URL(process.env.REDIS_URL!); redisUrl.pathname = '/14'
const isolatedRedis = new Redis(redisUrl.toString())
if (await isolatedRedis.dbsize()) throw new Error('Reserved fixture Redis database is occupied; refusing reuse')
process.env.REDIS_URL = redisUrl.toString()
const token = randomBytes(20).toString('hex')
const prefix = `/fixflags-reliability-${randomBytes(6).toString('hex')}`
const objects = new Map<string, Buffer>()
const messages: Array<Record<string, unknown>> = []
let broken = false, missingTitle = false, rejectNextEmail = false, fixtureEnabled = false
const requests: Array<{ method: string; path: string; status: number }> = []
const server = createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const body = Buffer.concat(chunks)
  const url = new URL(req.url!, 'http://localhost')
  if (url.pathname === '/tick' || url.pathname === '/retry') {
    if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(403); res.end(); return }
    try {
      const { prisma } = await import('../../lib/db')
      const { processDueProjectWatches, retryPendingWatchNotifications } = await import('../../lib/audit/project-watch')
      if (url.pathname === '/tick') {
        const { projectId } = JSON.parse(body.toString())
        const site = await prisma.project.findUnique({ where: { id: projectId }, include: { user: true } })
        if (!site?.user.email.startsWith('reliability-') || !site.user.email.endsWith('@example.invalid')) throw new Error('Not this fixture')
        if (await prisma.project.count({ where: { id: { not: projectId }, watchInterval: { not: null }, watchNextRunAt: { lte: new Date() } } })) throw new Error('Unrelated due Sites')
        await processDueProjectWatches(1)
        const run = await prisma.runRequest.findFirst({ where: { projectId, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } })
        if (!run) throw new Error('Watch did not create a run')
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ runId: run.id })); return
      }
      const candidates = await prisma.audit.findMany({ where: { recheckTrigger: 'WATCH', status: 'COMPLETED', watchNotificationStatus: { in: ['PENDING', 'FAILED', 'SENDING'] } }, include: { user: true } })
      if (candidates.some(audit => !audit.user?.email.startsWith('reliability-') || !audit.user.email.endsWith('@example.invalid'))) throw new Error('Unrelated pending alerts')
      await retryPendingWatchNotifications(); res.end('{}'); return
    } catch (error) { res.writeHead(409); res.end(error instanceof Error ? error.message : String(error)); return }
  }
  if (url.pathname === '/control') {
    if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(403); res.end(); return }
    if (req.method === 'POST') {
      const update = JSON.parse(body.toString())
      if (typeof update.broken === 'boolean') broken = update.broken
      if (typeof update.missingTitle === 'boolean') missingTitle = update.missingTitle
      if (typeof update.rejectNextEmail === 'boolean') rejectNextEmail = update.rejectNextEmail
      if (typeof update.fixtureEnabled === 'boolean') fixtureEnabled = update.fixtureEnabled
    }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ messages, requests, objects: [...objects.keys()], broken, prefix })); return
  }
  if (url.pathname === '/emails') {
    if (req.headers.authorization !== 'Bearer re_local_transport_fixture') { res.writeHead(403); res.end(); return }
    res.setHeader('Content-Type', 'application/json')
    if (rejectNextEmail) { rejectNextEmail = false; res.writeHead(429); res.end(JSON.stringify({ name: 'rate_limit_exceeded', message: 'Controlled retryable delivery failure' })); return }
    const key = req.headers['idempotency-key']
    const existing = messages.find(message => message.key === key)
    if (existing) { res.end(JSON.stringify({ id: existing.id })); return }
    const message = { ...JSON.parse(body.toString()), key, id: `local-message-${messages.length + 1}` }; messages.push(message)
    res.end(JSON.stringify({ id: message.id })); return
  }
  if (url.pathname.startsWith('/evidence/')) {
    if (!req.headers.authorization?.startsWith('AWS4-HMAC-SHA256 ')) { res.writeHead(403); res.end(); return }
    const key = decodeURIComponent(url.pathname.slice('/evidence/'.length))
    if (req.method === 'PUT') { objects.set(key, body); res.writeHead(200, { ETag: '"local-fixture"' }); res.end(); return }
    if (req.method === 'GET' && objects.has(key)) { res.setHeader('Content-Type', 'image/png'); res.end(objects.get(key)); return }
    res.writeHead(404, { 'Content-Type': 'application/xml' }); res.end('<Error><Code>NoSuchKey</Code></Error>'); return
  }
  // Observable website behavior, reached by real browser actions and HTTP requests.
  const status = url.pathname.endsWith('/checkout') && broken ? 503 : 200
  requests.push({ method: req.method!, path: url.pathname, status })
  res.writeHead(status, { 'Content-Type': 'text/html', 'X-Content-Type-Options': 'nosniff' })
  const title = missingTitle ? '' : '<title>Trail Supply — outdoor equipment for your next trip</title>'
  const checkout = url.pathname.endsWith('/checkout')
  res.end(`<!doctype html><html lang="en"><head>${title}<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Find thoughtfully selected outdoor equipment for hiking and camping. Review your cart and continue to checkout safely."><style>body{margin:0;font:18px system-ui;color:#18232c;background:#fafaf8}main{max-width:760px;margin:70px auto;padding:24px}a,button{display:inline-block;padding:16px;background:#163b2f;color:white;border-radius:8px}h1{font-size:40px}</style></head><body><main>${checkout ? `<h1>${broken ? 'Checkout is temporarily unavailable' : 'Checkout'}</h1><p>${broken ? 'Please try again later.' : 'Review your order. This controlled fixture never places an order.'}</p>` : `<h1>Equipment for your next outdoor adventure</h1><p>Choose your hiking pack and continue to checkout. Free shipping on orders over $50.</p><p>Trail Pack — $75</p><a href="${prefix}/checkout">Buy now</a><p>Contact: help@example.invalid</p>`}</main></body></html>`)
})
await new Promise<void>(resolve => server.listen(3146, '127.0.0.1', resolve))
const fixtureOrigin = 'http://127.0.0.1:3146'
const nativeFetch = globalThis.fetch
// Only this worker process maps controlled transports. DNS/SSRF checks remain intact.
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.hostname === 'api.resend.com') return nativeFetch(`${fixtureOrigin}${url.pathname}`, init)
  if (fixtureEnabled && url.hostname === 'example.com') return nativeFetch(`${fixtureOrigin}${url.pathname}${url.search}`, init)
  if (url.hostname === 'www.googleapis.com') return new Response('{}', { status: 503 })
  return nativeFetch(input, init)
}
const launch = chromium.launch.bind(chromium)
chromium.launch = async (options) => {
  const browser = await launch(options)
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async (options) => {
    const context = await newContext(options)
    const newPage = context.newPage.bind(context)
    context.newPage = async () => {
      const page = await newPage()
      const route = page.route.bind(page)
      // Install the fixture as the continuation of the real route safety guard.
      page.route = async (matcher, handler, options) => route(matcher, async (current, request) => {
        const originalContinue = current.continue.bind(current)
        current.continue = async (overrides) => {
          const url = new URL(request.url())
          if (fixtureEnabled && url.hostname === 'example.com') {
            const response = await nativeFetch(`${fixtureOrigin}${url.pathname}${url.search}`, { method: request.method(), body: request.method() === 'GET' ? undefined : request.postData() })
            await current.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) }); return
          }
          return originalContinue(overrides)
        }
        if (typeof handler === 'function') await handler(current, request)
      }, options)
      return page
    }
    return context
  }
  return browser
}
Object.assign(process.env, {
  NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3145', BETTER_AUTH_URL: 'http://127.0.0.1:3145',
  RESEND_API_KEY: 're_local_transport_fixture', RESEND_FROM_EMAIL: 'FixFlags <watch@example.invalid>',
  R2_ACCOUNT_ID: 'local-fixture', R2_ACCESS_KEY_ID: 'local-fixture', R2_SECRET_ACCESS_KEY: 'local-fixture', R2_BUCKET_NAME: 'evidence', R2_PUBLIC_URL: fixtureOrigin,
  R2_S3_ENDPOINT: fixtureOrigin, R2_FORCE_PATH_STYLE: 'true', FIXFLAGS_ALLOW_DEGRADED_LOCAL: 'true',
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: chromium.executablePath(),
})
// No recovery scheduler: it would inspect unrelated local Sites.
const { startWorker } = await import('../../lib/queue/worker')
const worker = startWorker()
await worker.waitUntilReady()
const { getAuditBrowser, getBrowserDiagnostics } = await import('../../lib/audit/screenshot')
const { touchWorkerHeartbeat } = await import('../../lib/queue/worker-heartbeat')
await getAuditBrowser()
await touchWorkerHeartbeat({ browserOk: getBrowserDiagnostics().connected, queueState: 'idle' })
const web = spawn(process.execPath, ['.next-verify/standalone/server.js'], { env: { ...process.env, PORT: '3145', HOSTNAME: '127.0.0.1', FIXFLAGS_PROCESS_ROLE: 'web' }, stdio: 'inherit' })
await mkdir('.cache', { recursive: true })
await writeFile('.cache/customer-reliability-runtime.json', JSON.stringify({ token, prefix, redisUrl: redisUrl.toString(), fixtureOrigin }))
console.log('LOCAL RELIABILITY FIXTURE READY: app 3145, transport 3146; no external email or storage')
process.on('SIGTERM', () => { web.kill(); server.close(); void worker.close().finally(async () => { const keys = await isolatedRedis.keys('*'); if (keys.length) await isolatedRedis.del(...keys); await isolatedRedis.quit(); process.exit(0) }) })

}
main().catch(error => { console.error(error.message); process.exit(1) })
