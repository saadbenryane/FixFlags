import { createHash, createHmac, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { hashPassword } from 'better-auth/crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { readWorkerHeartbeat, clearWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { TASK_QUEUES } from '@/lib/audit/progressive/queues'
import { siteFlagPanelSchema } from '@/lib/sites/flag-panel'
import { siteHomeViewSchema } from '@/lib/sites/site-view-contract'
import { chromium, expect as browserExpect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { inspectAccessibilityViolations } from '../../e2e/approved-contrast'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { CARE_HOME } from '@/lib/marketing/copy/care-homepage'
import { AUDIT_ERRORS } from '@/lib/marketing/copy/errors'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy/workspace'
import { outcomeStatusLabel } from '@/lib/sites/outcome-state'
import { AUTH } from '@/lib/marketing/copy/auth'
import { ensureReleasePasswordAccount } from '@/lib/release/fixture-authentication'
import { repairBriefSchema } from '@/lib/sites/repair-brief-contract'
import { MCP_PROTOCOL_VERSION, MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { NOTIFICATIONS_COPY } from '@/lib/marketing/copy/notifications'
import { SITE_SETTINGS_COPY } from '@/lib/marketing/copy/site-settings'
import { processDueProjectWatches } from '@/lib/audit/project-watch'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { productTransaction } from '@/lib/billing/product-transaction'
import { UPTIME_CONFIRMATION_MS, UPTIME_INTERVAL_MS } from '@/lib/uptime/domain'
import { loadUptimeSummary } from '@/lib/uptime/queries'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { readScheduledContext } from '@/lib/sites/application/scheduled-observation'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { readArtifact } from '@/lib/audit/progressive/contracts'
import { speedArtifactSchema } from '@/lib/audit/progressive/snapshots'
import { checkArtifactSchema } from '@/lib/audit/progressive/results'
import { performanceMeasurementSchema } from '@/lib/audit/performance-measurement-contract'

const authProof = process.env.COMPILED_AUTH_REQUIRED === 'true'
const pageSpeedProof = process.env.COMPILED_PAGESPEED_REQUIRED === 'true'
const signupProof = process.env.COMPILED_SIGNUP_REQUIRED === 'true'
const publicEntryProof = pageSpeedProof || signupProof || process.env.COMPILED_PUBLIC_ENTRY_REQUIRED === 'true'
const notificationProof = process.env.COMPILED_NOTIFICATION_REQUIRED === 'true'
const interruptionProof = process.env.COMPILED_INTERRUPTION_REQUIRED === 'true'
const sharedWatchProof = process.env.COMPILED_SHARED_WATCH_REQUIRED === 'true'
const uptimeProof = process.env.COMPILED_UPTIME_REQUIRED === 'true'
const defaultWatchProof = process.env.COMPILED_DEFAULT_WATCH_REQUIRED === 'true'
const cliProof = process.env.COMPILED_CLI_REQUIRED === 'true'
const operationsProof = process.env.COMPILED_OPERATIONS_REQUIRED === 'true'
const settingsProof = process.env.COMPILED_SETTINGS_REQUIRED === 'true'
const browserProof = authProof || process.env.COMPILED_BROWSER_REQUIRED === 'true'
const webProof = settingsProof || operationsProof || cliProof || sharedWatchProof || notificationProof || publicEntryProof || browserProof || process.env.COMPILED_WEB_REQUIRED === 'true'
const run = webProof || interruptionProof || uptimeProof || defaultWatchProof || process.env.COMPILED_WORKER_REQUIRED === 'true' ? describe : describe.skip
run('compiled production ' + (webProof ? 'web API and worker' : 'worker') + ' against disposable services', () => {
  const userId = 'compiled-worker-' + randomUUID(), projectId = userId + '-site'
  const browserUserId = 'browser-owner-' + randomUUID()
  const publicUserId = 'public-entry-owner-' + randomUUID()
  let worker: ChildProcess | undefined, web: ChildProcess | undefined, output = '', url = '', repaired = false
  let webOrigin = '', sessionCookie = ''
  let workerHealthOrigin = ''
  let workerEnvironment: NodeJS.ProcessEnv
  let interruptionGateOpen = false, interruptionRequests = 0
  let sharedWatchGateOpen = true
  const heldWatchResponses: Array<() => void> = []
  let uptimeHealthy = false
  const uptimeRequests: Array<{ at: string; method: string; status: number }> = []
  const fixtureUsers: string[] = []
  const password = 'Local-fixture-password-20261028'
  // Generated by the published @better-auth/utils 0.4.2 used by auth 1.6.24.
  const legacyPasswordHash = 'aa54904345867560e0ee92f970daf22e:d842ce39f560f54dba3ff3c4d85beb55b16c75ec72d3b33a68f356d5a9ded1d30b13a37bd3cd8861c9580600f11365358eaaf2f2fede33291b2c230a1f7f99e1'
  const providerRefusal = join(tmpdir(), userId + '-provider-refusal.cjs')
  const workerBootGate = join(tmpdir(), userId + '-worker-boot-gate')
  const workerPidFile = join(tmpdir(), userId + '-worker-pid')
  const pageSpeedObservation = join(tmpdir(), userId + '-pagespeed-')
  const localMailSecret = 'whsec_' + Buffer.from('compiled-local-delivery-fixture-key').toString('base64')
  const mailRecipient = userId + '@notification-fixture.fixflags.dev'
  const mailProviderId = randomUUID(), earlyEventId = randomUUID()
  const mailRequests: Array<{ key: string | undefined; body: Record<string, unknown> }> = []
  const bridgeHolds: Array<{ id: string | number; closed: boolean }> = []
  let earlyEventStatus: number | undefined
  const server = createServer((request, response) => {
    if (cliProof && request.url === '/bridge/api/mcp' && request.method === 'POST') {
      let body = ''
      request.on('data', chunk => { body += chunk })
      request.on('end', () => {
        const frame = JSON.parse(body)
        if (frame.params?._meta?.fixtureHold === true) {
          const held = { id: frame.id, closed: false }
          bridgeHolds.push(held)
          response.on('close', () => { held.closed = !response.writableEnded })
          return
        }
        const controller = new AbortController()
        response.on('close', () => { if (!response.writableEnded) controller.abort() })
        const headers = Object.fromEntries(['authorization', 'content-type', 'accept', 'mcp-protocol-version', 'mcp-method', 'mcp-name']
          .flatMap(name => typeof request.headers[name] === 'string' ? [[name, request.headers[name] as string]] : []))
        void fetch(webOrigin + '/api/mcp', { method: 'POST', headers, body, signal: controller.signal }).then(async upstream => {
          const data = await upstream.arrayBuffer()
          if (!response.destroyed) response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' }).end(Buffer.from(data))
        }).catch(() => { if (!response.destroyed) response.writeHead(502).end() })
      })
      return
    }
    if (uptimeProof && request.url === '/uptime-target') {
      const status = uptimeHealthy ? 200 : 503
      uptimeRequests.push({ at: new Date().toISOString(), method: request.method!, status })
      response.writeHead(status, { 'content-type': 'text/html' }).end('<!doctype html><title>Controlled uptime target</title><h1>' +
        (uptimeHealthy ? 'Service available' : 'Service unavailable') + '</h1>')
      return
    }
    if (interruptionProof && request.url === '/interruption-gate.js') {
      interruptionRequests++
      if (interruptionGateOpen) response.writeHead(200, { 'content-type': 'application/javascript' }).end('void 0')
      // An actual browser waits on this script until its worker is killed.
      // The closed browser connection releases the held response naturally.
      return
    }
    if ((sharedWatchProof || notificationProof || signupProof) && request.url === '/notification-provider/emails') {
      void (async () => {
        if (request.method !== 'POST' || request.headers.authorization !== 'Bearer re_compiled_local_fixture') {
          response.writeHead(403).end(); return
        }
        let raw = ''
        for await (const chunk of request) {
          raw += chunk.toString()
          if (Buffer.byteLength(raw) > 65_536) { response.writeHead(413).end(); return }
        }
        const key = request.headers['idempotency-key']
        mailRequests.push({ key: Array.isArray(key) ? key[0] : key, body: JSON.parse(raw) })
        if (notificationProof && mailRequests.length === 1) {
          earlyEventStatus = (await deliveryEvent('email.delivered', earlyEventId)).status
          // Model acceptance with a lost response, without replacing SDK calls.
          // The next physical request must retain this body and provider key.
          request.socket.destroy(); return
        }
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ id: signupProof ? randomUUID() : mailProviderId }))
      })().catch(error => { output += '\nLocal mail fixture: ' + String(error); response.writeHead(500).end() })
      return
    }
    if (sharedWatchProof && request.url === '/' && !sharedWatchGateOpen) {
      heldWatchResponses.push(() => response.writeHead(503, { 'content-type': 'text/html' }).end('<!doctype html><title>Controlled unavailable page</title><h1>Service unavailable</h1>'))
      return
    }
    if (sharedWatchProof) response.statusCode = 503
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>Compiled worker fixture</title>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      (interruptionProof && request.url === '/interrupted' ? '<script src="/interruption-gate.js"></script>' : '') + '</head><body><main>' +
      '<h1>Choose an action</h1><button id="action" style="width:64px;height:44px"' +
      (repaired ? ' aria-label="Continue"' : '') + '></button></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED !== 'true' ||
      !['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    if (!existsSync('dist/worker/index.js') || !existsSync('dist/worker/check-parser.js'))
      throw new Error('Run npm run worker:build before compiled runtime verification')
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    url = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/'
    if (webProof) {
      const reservation = createServer()
      await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve))
      const port = (reservation.address() as { port: number }).port
      await new Promise<void>(resolve => reservation.close(() => resolve()))
      webOrigin = 'http://' + (authProof ? 'localhost' : '127.0.0.1') + ':' + port
    }
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', emailVerified: true, role: 'user' } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Compiled runtime fixture', url,
      canonicalHost: '127.0.0.1', accountChecksEnabled: false, notificationLevel: 'OFF',
      watchInterval: 'WEEKLY', watchPausedAt: new Date() } })
    // Seed only the admitted URL, without supplying a passing inspection.
    await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: { url, normalizedUrl: url, role: 'primary', position: 0, status: 'COMPLETED' } } } })
    const env = { ...process.env }
    for (const key of Object.keys(env)) if (/SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY|CLIENT_ID/.test(key)) env[key] = ''
    Object.assign(env, { NODE_ENV: 'production', FIXFLAGS_PROCESS_ROLE: 'worker', FIXFLAGS_ALLOW_DEGRADED_LOCAL: 'true',
      NEXT_PUBLIC_APP_URL: webOrigin || 'http://127.0.0.1:3000', BETTER_AUTH_URL: webOrigin || 'http://127.0.0.1:3000',
      BETTER_AUTH_SECRET: 'compiled-runtime-local-fixture-secret', TOKEN_ENCRYPTION_KEY: '11'.repeat(32), WORKER_HEALTH_PORT: '0' })
    if (pageSpeedProof) {
      if (!process.env.COMPILED_PAGESPEED_API_KEY) throw new Error('Provide the bounded PageSpeed verification key in the process environment')
      env.PAGESPEED_API_KEY = process.env.COMPILED_PAGESPEED_API_KEY
    }
    if (sharedWatchProof || notificationProof || signupProof) Object.assign(env, { RESEND_API_KEY: 're_compiled_local_fixture',
      RESEND_BASE_URL: url + 'notification-provider', RESEND_FROM_EMAIL: 'FixFlags <local-sender@fixture.fixflags.dev>',
      RESEND_DELIVERY_WEBHOOK_SECRET: localMailSecret })
    if (signupProof) env.REQUIRE_EMAIL_VERIFICATION = 'true'
    // Hold only the real worker child before import, so its wrapper's starting
    // health is observable without relying on machine or browser launch speed.
    // Collectors and classifiers remain real; external providers are refused.
    writeFileSync(providerRefusal, `
        if (process.argv[1] === require('node:path').resolve('dist/worker/index.js')) {
          require('node:fs').writeFileSync(${JSON.stringify(workerPidFile)}, String(process.pid));
          const wait = new Int32Array(new SharedArrayBuffer(4));
          while (!require('node:fs').existsSync(${JSON.stringify(workerBootGate)})) Atomics.wait(wait, 0, 0, 25);
        }
        const original = globalThis.fetch;
        if (${uptimeProof}) {
          const dns = require('node:dns/promises');
          const resolve4 = dns.Resolver.prototype.resolve4, resolve6 = dns.Resolver.prototype.resolve6;
          dns.Resolver.prototype.resolve4 = function(host, ...args) { return host === 'example.com' ? Promise.resolve(['203.0.114.1']) : resolve4.call(this, host, ...args); };
          dns.Resolver.prototype.resolve6 = function(host, ...args) { return host === 'example.com' ? Promise.resolve([]) : resolve6.call(this, host, ...args); };
        }
        const publicEntryAllowed = (target, method = 'GET') => ${publicEntryProof} &&
          target.href === 'https://example.com/' && ['GET', 'HEAD'].includes(method.toUpperCase());
        globalThis.fetch = async (input, options) => {
          const target = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url);
          if (${uptimeProof} && target.href === 'http://example.com/')
            return original(${JSON.stringify(url + 'uptime-target')}, options);
          if (${pageSpeedProof} && target.origin === 'https://www.googleapis.com' && target.pathname === '/pagespeedonline/v5/runPagespeed') {
            const strategy = target.searchParams.get('strategy');
            if (target.searchParams.get('url') !== 'https://example.com/' || !['desktop','mobile'].includes(strategy) ||
                target.searchParams.get('key') !== process.env.PAGESPEED_API_KEY)
              throw new Error('PageSpeed request is outside the fixed verification scope');
            const fs = require('node:fs'), path = ${JSON.stringify(pageSpeedObservation)} + strategy + '.json';
            try { fs.closeSync(fs.openSync(path, 'wx')); }
            catch { throw new Error('PageSpeed verification request budget already consumed'); }
            const startedAt = new Date().toISOString();
            fs.writeFileSync(path, JSON.stringify({ strategy, startedAt, status: null }));
            try {
              const response = await original(input, { ...options, redirect: 'error' });
              fs.writeFileSync(path, JSON.stringify({ strategy, startedAt, completedAt: new Date().toISOString(), status: response.status }));
              return response;
            } catch (error) {
              fs.writeFileSync(path, JSON.stringify({ strategy, startedAt, completedAt: new Date().toISOString(), status: null, error: error.name }));
              throw new Error('Bounded PageSpeed transport did not complete');
            }
          }
          if (target.hostname === 'www.googleapis.com' && target.pathname === '/pagespeedonline/v5/runPagespeed')
            return new Response('Explicit local provider refusal fixture, not live provider evidence', { status: 403 });
          if (['http:', 'https:'].includes(target.protocol) && !['localhost', '127.0.0.1'].includes(target.hostname) &&
              !publicEntryAllowed(target, options?.method ?? input?.method ?? 'GET'))
            throw new Error('External transport is disabled in this local browser fixture');
          return original(input, options);
        };
        if (${publicEntryProof}) {
          const chromium = require(require.resolve('playwright', { paths: [process.cwd()] })).chromium;
          for (const method of ['launch', 'connect']) {
          const open = chromium[method].bind(chromium);
          chromium[method] = async (...args) => {
            const browser = await open(...args);
            const newContext = browser.newContext.bind(browser);
            browser.newContext = async (...options) => {
              const context = await newContext(...options);
              await context.route('**/*', route => {
                const request = route.request(), target = new URL(request.url());
                return ['http:', 'https:'].includes(target.protocol) &&
                  !['localhost', '127.0.0.1'].includes(target.hostname) && !publicEntryAllowed(target, request.method())
                  ? route.abort('blockedbyclient') : route.fallback();
              });
              return context;
            };
            return browser;
          };
          }
        }
      `)
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require=${providerRefusal}`.trim()
    workerEnvironment = env
    worker = spawn(process.execPath, ['scripts/runtime-start.mjs', 'worker'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    worker.stdout!.on('data', record); worker.stderr!.on('data', record)
    await vi.waitFor(async () => {
      if (worker!.exitCode !== null) throw new Error('Compiled worker bootstrap exited: ' + output)
      expect(workerHealthOrigin).not.toBe('')
      const health = await fetch(workerHealthOrigin, { signal: AbortSignal.timeout(2000) })
      expect(health.status).toBe(503)
      expect(await health.json()).toEqual({ status: 'starting', ready: false })
    }, { timeout: 30_000, interval: 100 })
    writeFileSync(workerBootGate, 'start')
    await vi.waitFor(async () => {
      if (worker!.exitCode !== null) throw new Error('Compiled worker exited: ' + output)
      expect(await readWorkerHeartbeat()).toMatchObject({ alive: true, browserOk: true })
      const health = await fetch(workerHealthOrigin, { signal: AbortSignal.timeout(2000) })
      expect(health.status).toBe(200)
      expect(await health.json()).toEqual({ status: 'ready', ready: true })
    }, { timeout: 30_000, interval: 100 })
    if (webProof) {
      const entry = (process.env.NEXT_DIST_DIR || '.next') + '/standalone/server.js'
      if (!existsSync(entry)) throw new Error('Build the web runtime with the selected NEXT_DIST_DIR first')
      const port = new URL(webOrigin).port
      await prisma.account.create({ data: { userId, accountId: userId, providerId: 'credential', password: legacyPasswordHash } })
      web = spawn(process.execPath, ['scripts/runtime-start.mjs', 'web'], { env: { ...env, FIXFLAGS_PROCESS_ROLE: 'web', PORT: String(port), HOSTNAME: '127.0.0.1',
        BETTER_AUTH_URL: webOrigin, NEXT_PUBLIC_APP_URL: webOrigin }, stdio: ['ignore', 'pipe', 'pipe'] })
      web.stdout!.on('data', record); web.stderr!.on('data', record)
      await vi.waitFor(async () => {
        if (web!.exitCode !== null) throw new Error('Compiled web process exited: ' + output)
        const health = await fetch(webOrigin + '/api/health', { signal: AbortSignal.timeout(2000) })
        expect(health.status, output).toBe(200)
        expect(await health.json()).toMatchObject({ database: 'ok', aiConfigured: false, storageConfigured: false })
      }, { timeout: 15_000, interval: 100 })
      const signIn = await fetch(webOrigin + '/api/auth/sign-in/email', { method: 'POST',
        headers: { 'content-type': 'application/json', origin: webOrigin },
        body: JSON.stringify({ email: userId + '@example.test', password }) })
      expect(signIn.status, output).toBe(200)
      sessionCookie = signIn.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')
      expect(Boolean(sessionCookie)).toBe(true)
      expect(siteHomeViewSchema.parse(await http('/api/sites/' + projectId)).site.siteId).toBe(projectId)
    }
  }, 60_000)
  afterAll(async () => {
    if (worker && !existsSync(workerBootGate)) writeFileSync(workerBootGate, 'stop')
    if (web && web.exitCode === null && web.signalCode === null) {
      const stopped = new Promise<void>(resolve => web!.once('exit', () => resolve()))
      web.kill('SIGTERM')
      const timer = setTimeout(() => web!.kill('SIGKILL'), 5000)
      try { await stopped } finally { clearTimeout(timer) }
    }
    if (worker && worker.exitCode === null && worker.signalCode === null) {
      const stopped = new Promise<void>(resolve => worker!.once('exit', () => resolve()))
      worker.kill('SIGTERM')
      const timer = setTimeout(() => worker!.kill('SIGKILL'), 15_000)
      try { await stopped } finally { clearTimeout(timer) }
    }
    const heartbeatAfterShutdown = await readWorkerHeartbeat()
    let healthAfterShutdown: number | undefined
    if (workerHealthOrigin) {
      const health = await fetch(workerHealthOrigin, { signal: AbortSignal.timeout(2000) }).catch(() => null)
      healthAfterShutdown = health?.status
    }
    await clearWorkerHeartbeat()
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(resource => getAuditTaskQueue(resource as keyof typeof TASK_QUEUES))]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.emailProviderEvent.deleteMany({ where: { providerId: mailProviderId } })
    await prisma.emailSuppression.deleteMany({ where: { recipientHash: createHash('sha256').update(mailRecipient).digest('hex') } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, browserUserId, publicUserId, ...fixtureUsers] } } }); await prisma.$disconnect(); vi.unstubAllEnvs()
    if (existsSync(providerRefusal)) unlinkSync(providerRefusal)
    if (existsSync(workerBootGate)) unlinkSync(workerBootGate)
    if (existsSync(workerPidFile)) unlinkSync(workerPidFile)
    for (const strategy of ['desktop', 'mobile']) if (existsSync(pageSpeedObservation + strategy + '.json')) unlinkSync(pageSpeedObservation + strategy + '.json')
    expect(heartbeatAfterShutdown?.alive).not.toBe(true)
    expect(healthAfterShutdown).not.toBe(200)
    if (worker) expect(worker.exitCode, output).toBe(0)
  }, 25_000)
  function record(chunk: Buffer) {
    output = (output + chunk.toString()).slice(-24_000)
    const port = /\[health\] Worker health server listening on port (\d+)/.exec(output)?.[1]
    if (port) workerHealthOrigin = 'http://127.0.0.1:' + port
  }
  function localProcesses() {
    return execFileSync('ps', ['-axo', 'pid=,ppid=,stat=,comm='], { encoding: 'utf8' }).trim().split('\n').flatMap(line => {
      const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line)
      return match ? [{ pid: Number(match[1]), parent: Number(match[2]), state: match[3], command: match[4] }] : []
    })
  }
  async function http(path: string, body?: object, key?: string) {
    const response = await fetch(webOrigin + path, { method: body ? 'POST' : 'GET',
      headers: { cookie: sessionCookie, origin: webOrigin, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000) })
    const payload = await response.json()
    expect(response.ok, JSON.stringify(payload) + '\n' + output).toBe(true)
    return payload
  }
  async function deliveryEvent(type: string, id = randomUUID(), validSignature = true) {
    const payload = JSON.stringify({ type, created_at: new Date().toISOString(), data: {
      email_id: mailProviderId, from: 'FixFlags <local-sender@fixture.fixflags.dev>', to: [mailRecipient],
    } })
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', Buffer.from(localMailSecret.slice(6), 'base64'))
      .update(`${id}.${timestamp}.${payload}`).digest('base64')
    return fetch(webOrigin + '/api/webhooks/resend/delivery', { method: 'POST', body: payload,
      headers: { 'content-type': 'application/json', 'svix-id': id, 'svix-timestamp': timestamp,
        'svix-signature': 'v1,' + (validSignature ? signature : Buffer.alloc(32).toString('base64')) },
      signal: AbortSignal.timeout(5000) })
  }
  async function complete(auditId: string) {
    expect(auditId).toEqual(expect.any(String))
    await vi.waitFor(async () => {
      if (worker!.exitCode !== null) throw new Error('Compiled worker exited: ' + output)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
        .toMatchObject({ status: 'COMPLETED', improvementProjectedAt: expect.any(Date) })
    }, { timeout: 40_000, interval: 100 })
  }
  it.skipIf(!interruptionProof)('recovers the same native browser task after worker death while another Site progresses', async () => {
    const interruptedUrl = url + 'interrupted'
    await prisma.project.update({ where: { id: projectId }, data: { url: interruptedUrl } })
    // Record only the admitted page. The live browser must collect its facts.
    await prisma.audit.create({ data: { projectId, userId, url: interruptedUrl, status: 'COMPLETED', completedAt: new Date(),
      createdAt: new Date(Date.now() + 1), reportCompleteness: 'PARTIAL',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: interruptedUrl,
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: { url: interruptedUrl, normalizedUrl: interruptedUrl, role: 'primary', position: 0, status: 'COMPLETED' } } } })
    const admission = { projectId, userId, scope: 'CATEGORY' as const, categoryArea: 'accessibility' as const,
      source: 'WEB' as const, outcomeIds: [], idempotencyKey: 'interrupted-native-browser' }
    const source = await requestSiteRun(admission)
    await vi.waitFor(async () => {
      expect(interruptionRequests).toBeGreaterThan(0)
      expect(await prisma.auditExecutionTask.findFirst({ where: { auditId: source.auditId!, targetKey: 'task:p0:browser', workKind: 'browser', pageUrl: interruptedUrl } }))
        .toMatchObject({ workState: 'RUNNING', workAttempts: 1, workGeneration: 1, workToken: expect.any(String) })
    }, { timeout: 15_000, interval: 50 })
    const interrupted = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: source.auditId!, targetKey: 'task:p0:browser', workKind: 'browser', pageUrl: interruptedUrl } })
    const deadPid = Number(readFileSync(workerPidFile, 'utf8'))
    expect(Number.isSafeInteger(deadPid) && deadPid > 1).toBe(true)
    const processes = localProcesses(), owned = new Set([worker!.pid!])
    expect(processes.find(process => process.pid === deadPid)).toMatchObject({ parent: worker!.pid })
    for (;;) {
      const children = processes.filter(process => owned.has(process.parent) && !owned.has(process.pid))
      if (!children.length) break
      children.forEach(process => owned.add(process.pid))
    }
    const browserPids = processes.filter(process => owned.has(process.pid) && /chrome|chromium/i.test(process.command)).map(process => process.pid)
    expect(browserPids.length).toBeGreaterThan(0)
    const stopped = new Promise<void>(resolve => worker!.once('exit', () => resolve()))
    process.kill(deadPid, 'SIGKILL')
    await stopped
    expect(worker!.signalCode).toBe('SIGKILL')
    await vi.waitFor(() => expect(localProcesses().filter(process => browserPids.includes(process.pid) && !process.state.startsWith('Z')))
      .toEqual([]), { timeout: 10_000, interval: 100 })
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: interrupted.id } })).toMatchObject({
      workState: 'RUNNING', workToken: interrupted.workToken, workGeneration: interrupted.workGeneration,
      workLeaseUntil: interrupted.workLeaseUntil, workResult: null })
    interruptionGateOpen = true
    const directory = 'test-results/runtime/compiled-interruption-' + userId
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'interrupted-worker.log'), output)
    output = ''; workerHealthOrigin = ''
    worker = spawn(process.execPath, ['scripts/runtime-start.mjs', 'worker'], {
      env: workerEnvironment, stdio: ['ignore', 'pipe', 'pipe'] })
    worker.stdout!.on('data', record); worker.stderr!.on('data', record)
    await vi.waitFor(async () => {
      expect(worker!.exitCode, output).toBeNull()
      expect(workerHealthOrigin).not.toBe('')
      expect((await fetch(workerHealthOrigin, { signal: AbortSignal.timeout(2000) })).status, output).toBe(200)
    }, { timeout: 30_000, interval: 100 })
    const newPid = Number(readFileSync(workerPidFile, 'utf8'))
    expect(newPid).not.toBe(deadPid)
    expect(await requestSiteRun(admission)).toMatchObject({ runId: source.runId, auditId: source.auditId, reused: true })

    const siblingUserId = 'interruption-sibling-' + randomUUID()
    fixtureUsers.push(siblingUserId)
    await prisma.user.create({ data: { id: siblingUserId, email: siblingUserId + '@example.test', emailVerified: true } })
    const sibling = await prisma.project.create({ data: { userId: siblingUserId, name: 'Independent Site fixture',
      canonicalHost: '127.0.0.1', url, accountChecksEnabled: false, notificationLevel: 'OFF',
      watchInterval: 'WEEKLY', watchPausedAt: new Date() } })
    await prisma.audit.create({ data: { projectId: sibling.id, userId: siblingUserId, url, status: 'COMPLETED',
      completedAt: new Date(), reportCompleteness: 'PARTIAL',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url,
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: { url, normalizedUrl: url, role: 'primary', position: 0, status: 'COMPLETED' } } } })
    const siblingRun = await requestSiteRun({ projectId: sibling.id, userId: siblingUserId, scope: 'CATEGORY',
      categoryArea: 'accessibility', source: 'WEB', outcomeIds: [], idempotencyKey: 'independent-native-browser' })
    await complete(siblingRun.auditId!)
    const siblingCompletedAt = Date.now()
    expect(siblingCompletedAt).toBeLessThan(interrupted.workLeaseUntil!.getTime())
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: interrupted.id } })).toMatchObject({
      workState: 'RUNNING', workToken: interrupted.workToken, workGeneration: interrupted.workGeneration })
    console.info('Compiled interruption: restarted worker completed independent Site before original lease expiry')

    // Wait for the real 90-second lease and scheduler-owned retry. No task,
    // Audit, queue, token or retry timestamp is advanced by this fixture.
    await vi.waitFor(async () => {
      expect(worker!.exitCode, output).toBeNull()
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: interrupted.id } }), output)
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 2, workGeneration: 2,
          workResult: { kind: 'browser', data: { metadata: { title: 'Compiled worker fixture' } } } })
    }, { timeout: 130_000, interval: 500 })
    await complete(source.auditId!)
    expect(await requestSiteRun(admission)).toMatchObject({ runId: source.runId, auditId: source.auditId, reused: true })
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
    const recovered = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: interrupted.id } })
    expect(recovered.workInput).toEqual(interrupted.workInput)
    expect(await prisma.flag.count({ where: { auditId: source.auditId!, checkId: 'buttons-no-text' } })).toBe(1)
    expect(await prisma.flag.count({ where: { auditId: siblingRun.auditId!, checkId: 'buttons-no-text' } })).toBe(1)
    writeFileSync(join(directory, 'receipt.json'), JSON.stringify({
      scope: 'Compiled worker death during native browser navigation and natural lease recovery',
      deadPid, newPid, releasedBrowserPids: browserPids, runId: source.runId, auditId: source.auditId, taskId: interrupted.id,
      originalLeaseUntil: interrupted.workLeaseUntil, siblingCompletedAt: new Date(siblingCompletedAt).toISOString(),
      attempts: recovered.workAttempts, generation: recovered.workGeneration, interruptionRequests,
      realProvidersUsed: false, productionChanged: false, clocksOrLeasesAdvanced: false,
    }, null, 2))
    writeFileSync(join(directory, 'recovered-worker.log'), output)
  }, 190_000)
  it.skipIf(!uptimeProof)('confirms an outage and recovers on a natural uptime slot without browser or scheduler intervention', async () => {
    const startedAt = new Date(), target = 'http://example.com/'
    await prisma.user.update({ where: { id: userId }, data: { auditsUsed: 3, auditsLimit: 3 } })
    const site = await prisma.project.create({ data: { userId, name: 'Natural uptime fixture', url: target, canonicalHost: 'example.com',
      watchInterval: 'WEEKLY', watchNextRunAt: new Date(startedAt.getTime() + 7 * 86400_000), notificationLevel: 'OFF', accountChecksEnabled: false } })
    expect(await prisma.uptimeMonitor.findUnique({ where: { projectId: site.id } })).toBeNull()
    // From this point the fixture only reads persisted work and changes its
    // controlled target response. The compiled runtime owns setup and timing.
    await vi.waitFor(async () => {
      expect(worker?.exitCode, output).toBeNull()
      const monitor = await prisma.uptimeMonitor.findUnique({ where: { projectId: site.id } })
      expect(monitor, output).toMatchObject({ enabled: true, state: 'offline' })
    }, { timeout: 120_000, interval: 1000 })
    const monitor = await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId: site.id } })
    const incident = await prisma.uptimeIncident.findFirstOrThrow({ where: { monitorId: monitor.id, recoveredAt: null } })
    const failed = await prisma.uptimeProbe.findMany({ where: { monitorId: monitor.id }, orderBy: { observedAt: 'asc' } })
    expect(failed).toHaveLength(2)
    expect(failed.map(probe => ({ attempt: probe.attempt, result: probe.result, status: probe.statusCode })))
      .toEqual([{ attempt: 1, result: 'FAILED', status: 503 }, { attempt: 2, result: 'FAILED', status: 503 }])
    expect(failed[1].scheduledAt).toEqual(failed[0].scheduledAt)
    expect(failed[1].observedAt.getTime() - failed[0].observedAt.getTime()).toBeGreaterThanOrEqual(UPTIME_CONFIRMATION_MS)
    expect(monitor.nextProbeAt.getTime() - failed[0].scheduledAt.getTime()).toBe(UPTIME_INTERVAL_MS)
    const repairAt = new Date()
    uptimeHealthy = true
    console.info('Natural uptime outage confirmed; waiting for original next slot:', monitor.nextProbeAt.toISOString())
    await vi.waitFor(async () => {
      expect(worker?.exitCode, output).toBeNull()
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({ state: 'online' })
      expect((await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).recoveredAt).not.toBeNull()
    }, { timeout: UPTIME_INTERVAL_MS + 90_000, interval: 1000 })
    const recovered = await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })
    const probes = await prisma.uptimeProbe.findMany({ where: { monitorId: monitor.id }, orderBy: { observedAt: 'asc' } })
    expect(probes).toHaveLength(3)
    expect(probes[2]).toMatchObject({ attempt: 1, result: 'ONLINE', statusCode: 200, targetUrl: target,
      scheduledAt: monitor.nextProbeAt })
    expect(probes[2].observedAt.getTime()).toBeGreaterThanOrEqual(monitor.nextProbeAt.getTime())
    expect(recovered.recoveredAt!.getTime()).toBeGreaterThanOrEqual(repairAt.getTime())
    expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(1)
    expect((await prisma.uptimeNotification.findMany({ where: { incidentId: incident.id } })).map(row => row.kind).sort())
      .toEqual(['DOWN', 'RECOVERED'])
    expect(await loadUptimeSummary({ kind: 'project', projectId: site.id, userId }))
      .toMatchObject({ enabled: true, state: 'online', openIncidentCount: 0 })
    expect(await prisma.audit.count({ where: { projectId: site.id } })).toBe(0)
    expect(uptimeRequests.map(request => request.status)).toEqual([503, 503, 200])
    expect(uptimeRequests.every(request => request.method === 'GET')).toBe(true)
    const directory = 'test-results/runtime/natural-uptime-' + userId
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'observations.json'), JSON.stringify({ startedAt, repairAt, completedAt: new Date(), target,
      monitorId: monitor.id, incident: recovered, probes, requests: uptimeRequests,
      intervalMs: UPTIME_INTERVAL_MS, confirmationMs: UPTIME_CONFIRMATION_MS,
      driver: 'Compiled uptime runtime timers and installed queue consumer', schedulerCallsFromTest: 0, queueCallsFromTest: 0,
      browserSession: false, clockOrDueTimeEditsAfterCreation: false, realProvidersUsed: false, productionChanged: false,
      transport: 'Public-scope URL and controlled DNS resolution, with native fetch routed only to the local HTTP target',
    }, null, 2))
    writeFileSync(join(directory, 'worker.log'), output)
  }, 540_000)

  it.skipIf(!defaultWatchProof)('initializes an unconfigured Site and collects native Flags through the compiled worker timers', async () => {
    const startedAt = new Date(), ownerId = 'default-watch-' + randomUUID()
    fixtureUsers.push(ownerId)
    await prisma.user.create({ data: { id: ownerId, email: ownerId + '@example.test', emailVerified: true, role: 'user' } })
    const site = await prisma.project.create({ data: { userId: ownerId, name: 'Automatic monitoring fixture', url,
      canonicalHost: '127.0.0.1', notificationLevel: 'OFF', accountChecksEnabled: false } })
    expect(site).toMatchObject({ watchInterval: null, watchNextRunAt: null, watchPausedAt: null })
    // Only Site identity is seeded. All subsequent persistence and admission
    // belong to the running worker, including defaults, collection and settlement.
    await vi.waitFor(async () => {
      expect(worker?.exitCode, output).toBeNull()
      expect(await prisma.runRequest.findFirst({ where: { projectId: site.id, source: 'WATCH' } }), output)
        .toMatchObject({ status: 'COMPLETED' })
    }, { timeout: 150_000, interval: 1000 })
    const requests = await prisma.runRequest.findMany({ where: { projectId: site.id } })
    expect(requests).toHaveLength(1)
    const request = requests[0]
    expect(request).toMatchObject({ source: 'WATCH', environment: 'production', executionSpec: { scope: 'SITE' } })
    const schedule = readScheduledContext(request.context)
    expect(schedule.success).toBe(true)
    if (!schedule.success) throw new Error('Automatic monitoring did not retain its schedule receipt')
    const current = await prisma.project.findUniqueOrThrow({ where: { id: site.id } })
    expect(current).toMatchObject({ watchInterval: 'WEEKLY', watchConsecutiveFailures: 0, watchLastError: null, watchLeaseUntil: null })
    expect(current.watchLastRunAt!.getTime()).toBeGreaterThanOrEqual(startedAt.getTime())
    expect(current.watchNextRunAt!.getTime()).toBe(schedule.data.nextRunAt)
    expect(current.watchNextRunAt!.getTime()).toBeGreaterThan(Date.now())
    expect(await prisma.audit.count({ where: { projectId: site.id } })).toBe(1)
    const collected = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: request.auditId!,
      targetKey: 'task:p0:browser', workKind: 'browser', workState: 'COMPLETED' } })
    expect(collected.workResult).toMatchObject({ kind: 'browser', data: { metadata: { title: 'Compiled worker fixture' } } })
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: request.auditId!, checkId: 'buttons-no-text' } })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    const home = await loadSiteHome(site.id, { ownerEvidence: true })
    expect(home!.flags).toEqual(expect.arrayContaining([expect.objectContaining({ id: occurrence.improvementId, sourceFlagId: flag.id })]))
    expect(home!.watch.interval).toBe('weekly')
    const directory = 'test-results/runtime/default-watch-' + userId
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'observations.json'), JSON.stringify({ startedAt, completedAt: new Date(),
      projectId: site.id, sourceAuditId: request.auditId, nativeCollectionTaskId: collected.id,
      sourceFlagId: flag.id, durableFlagId: occurrence.improvementId, request, schedule: schedule.data,
      savedMonitoring: { interval: current.watchInterval, nextRunAt: current.watchNextRunAt, lastRunAt: current.watchLastRunAt },
      driver: 'Compiled recovery scheduler timers and installed queue consumers',
      browserSession: false, schedulerCallsFromTest: 0, admissionCallsFromTest: 0, queueCallsFromTest: 0,
      clockOrDueTimeEditsAfterCreation: false, seededAuditOrFindings: false,
      realProvidersUsed: false, productionChanged: false,
      transport: 'Explicitly allowed loopback website fixture; no public target or real provider acceptance is claimed',
    }, null, 2))
    writeFileSync(join(directory, 'worker.log'), output)
  }, 180_000)

  it.skipIf(!cliProof)('uses the built CLI for native repair and recurrence and refuses failed MCP tools', async () => {
    const cliPath = process.env.COMPILED_CLI_PATH
    if (!cliPath || !existsSync(cliPath)) throw new Error('Provide the isolated built CLI entrypoint')
    const key = await http('/api/api-keys', { name: 'Local CLI repair proof', client: 'other', scopePreset: 'fix_and_verify', expiresInDays: 30 })
    const commands: Array<{ command: string; exitCode: number | null }> = []
    const cli = async (...args: string[]) => {
      const env: NodeJS.ProcessEnv = { ...Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG'].flatMap(name => process.env[name] ? [[name, process.env[name]]] : [])), NODE_ENV: 'production' }
      Object.assign(env, { FIXFLAGS_API_KEY: key.key, FIXFLAGS_API_URL: webOrigin, NO_COLOR: '1' })
      const child = spawn(process.execPath, [cliPath, ...args, '--json'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = '', stderr = ''
      child.stdout.on('data', chunk => { stdout += chunk }); child.stderr.on('data', chunk => { stderr += chunk })
      const timer = setTimeout(() => child.kill('SIGKILL'), 20_000)
      let code: number | null
      try { code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve) }) }
      finally { clearTimeout(timer) }
      commands.push({ command: args[0], exitCode: code })
      expect(stdout + stderr).not.toContain(key.key)
      return { code, data: JSON.parse(code === 0 ? stdout : stderr) }
    }
    const missing = await cli('flags', 'unavailable-site')
    expect(missing).toMatchObject({ code: 1, data: { error: { message: 'The requested Site, Outcome, run, or Flag was not found.' } } })
    expect(await cli('record-fix', projectId, 'unavailable-flag', 'Restored the original action name'))
      .toMatchObject({ code: 1, data: { error: { message: expect.any(String) } } })
    expect(await cli('verify-flag', projectId, 'unavailable-flag', 'unavailable-attempt'))
      .toMatchObject({ code: 1, data: { error: { message: expect.any(String) } } })
    expect(await prisma.improvementAttempt.count({ where: { improvement: { projectId } } })).toBe(0)
    const source = await http('/api/sites/' + projectId + '/runs', { scope: 'category', area: 'accessibility' }, 'cli-native-source')
    await complete(source.auditId)
    const original = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId: 'buttons-no-text' } })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: original.id } })
    const flagId = occurrence.improvementId
    expect(await cli('flags', projectId)).toMatchObject({ code: 0, data: { flags: expect.arrayContaining([expect.objectContaining({ flagId })]) } })
    const detail = await cli('flag', projectId, flagId)
    expect(detail.code).toBe(0)
    expect(repairBriefSchema.parse(detail.data.repairBrief).flag).toMatchObject({ sourceFlagId: original.id, sourceAuditId: source.auditId })
    repaired = true
    const recorded = await cli('record-fix', projectId, flagId, 'Added the original action accessible name')
    expect(recorded).toMatchObject({ code: 0, data: { status: 'RECORDED', attemptId: expect.any(String) } })
    const verification = await cli('verify-flag', projectId, flagId, recorded.data.attemptId)
    expect(verification).toMatchObject({ code: 0, data: { status: 'ACCEPTED', runId: expect.any(String), auditId: expect.any(String) } })
    await complete(verification.data.auditId)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: recorded.data.attemptId } })).toMatchObject({ outcome: 'IMPROVED' })
    expect(await cli('verify-flag', projectId, flagId, recorded.data.attemptId)).toMatchObject({ code: 0, data: { runId: verification.data.runId, auditId: verification.data.auditId } })
    const fixed = await cli('flags', projectId)
    expect(fixed.code).toBe(0)
    expect(fixed.data.flags.some((flag: { flagId: string }) => flag.flagId === flagId)).toBe(false)
    repaired = false
    const recurrence = await http('/api/sites/' + projectId + '/runs', { scope: 'category', area: 'accessibility' }, 'cli-native-recurrence')
    await complete(recurrence.auditId)
    expect(await cli('flags', projectId)).toMatchObject({ code: 0, data: { flags: expect.arrayContaining([expect.objectContaining({ flagId })]) } })
    const directory = 'test-results/runtime/cli-repair-' + userId
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'observations.json'), JSON.stringify({ commands, sourceAuditId: source.auditId,
      sourceFlagId: original.id, durableFlagId: flagId, attemptId: recorded.data.attemptId,
      verificationAuditId: verification.data.auditId, recurrenceAuditId: recurrence.auditId,
      failedToolsExitNonzero: true, nativeRepair: true, verificationReplayRetainsRun: true, sameFlagRecurs: true,
      credentialSource: 'Scoped 30-day developer key created through the compiled authenticated API in a disposable database',
      noKeychainOrConfigWrites: true, browserSession: false, realProvidersUsed: false, productionChanged: false,
    }, null, 2))
    writeFileSync(join(directory, 'worker.log'), output)
  }, 180_000)

  it.skipIf(!cliProof)('connects a native MCP SDK client through the packed CLI bridge for legacy and current protocols', async () => {
    const cliPath = process.env.COMPILED_CLI_PATH
    if (!cliPath || !existsSync(cliPath)) throw new Error('Provide the isolated built CLI entrypoint')
    const key = await http('/api/api-keys', { name: 'Local MCP SDK bridge proof', client: 'other', scopePreset: 'read_only', expiresInDays: 30 })
    const connections: Array<{ era: string; protocol: string | undefined; toolCount: number; cancelledHttpClosed: boolean }> = []
    for (const era of ['legacy', 'current'] as const) {
      const client = new Client({ name: 'native-bridge-proof', version: '1.0.0' }, {
        versionNegotiation: { mode: era === 'legacy' ? 'legacy' : { pin: MCP_PROTOCOL_VERSION } },
      })
      const env: Record<string, string> = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG'].flatMap(name => process.env[name] ? [[name, process.env[name]!]] : []))
      Object.assign(env, { FIXFLAGS_API_KEY: key.key, FIXFLAGS_API_URL: url + 'bridge', NO_COLOR: '1' })
      const transport = new StdioClientTransport({ command: process.execPath, args: [cliPath, 'mcp'], env, stderr: 'pipe' })
      let stderr = ''
      transport.stderr?.on('data', chunk => { stderr += chunk })
      try {
        await client.connect(transport, { timeout: 5000 })
        const tools = await client.listTools(undefined, { timeout: 5000 })
        expect(tools.tools.map(tool => tool.name)).toContain(MCP_TOOLS.getConnectionInfo.name)
        const connection = await client.callTool({ name: MCP_TOOLS.getConnectionInfo.name, arguments: {} }, { timeout: 5000 })
        expect(connection.isError).not.toBe(true)
        expect(connection.structuredContent).toMatchObject({ ready: true, authentication: { authenticated: true } })
        if (era === 'current') expect(connection.structuredContent).toMatchObject({ clientInfo: { name: 'native-bridge-proof', version: '1.0.0' } })
        const sites = await client.callTool({ name: MCP_TOOLS.listSites.name, arguments: {} }, { timeout: 5000 })
        expect(sites.isError).not.toBe(true)
        expect(sites.structuredContent).toMatchObject({ sites: expect.arrayContaining([expect.objectContaining({ siteId: projectId })]) })
        const missing = await client.callTool({ name: MCP_TOOLS.listFlags.name, arguments: { siteId: 'unavailable-site' } }, { timeout: 5000 })
        expect(missing).toMatchObject({ isError: true, structuredContent: { status: 'ERROR', error: { code: 'NOT_FOUND' } } })
        await expect(client.callTool({ name: MCP_TOOLS.recordFix.name, arguments: { siteId: projectId, flagId: 'unavailable-flag',
          idempotencyKey: 'read-only-bridge-refusal', changeSummary: 'A read-only key cannot record a repair' } }, { timeout: 5000 })).rejects.toThrow('cannot perform that action')
        const cancellation = new AbortController(), holdIndex = bridgeHolds.length
        const cancelledCall = client.callTool({ name: MCP_TOOLS.listSites.name, arguments: {}, _meta: { fixtureHold: true } },
          { signal: cancellation.signal, timeout: 5000 }).then(() => false, () => true)
        await vi.waitFor(() => expect(bridgeHolds[holdIndex]).toMatchObject({ closed: false }), { timeout: 3000 })
        const sibling = await client.callTool({ name: MCP_TOOLS.getConnectionInfo.name, arguments: {} }, { timeout: 5000 })
        expect(sibling.isError).not.toBe(true)
        cancellation.abort()
        expect(await cancelledCall).toBe(true)
        await vi.waitFor(() => expect(bridgeHolds[holdIndex].closed).toBe(true), { timeout: 3000 })
        const afterCancellation = await client.callTool({ name: MCP_TOOLS.listSites.name, arguments: {} }, { timeout: 5000 })
        expect(afterCancellation.isError).not.toBe(true)
        connections.push({ era, protocol: client.getNegotiatedProtocolVersion(), toolCount: tools.tools.length, cancelledHttpClosed: true })
      } finally {
        await client.close()
        expect(stderr).not.toContain(key.key)
      }
    }
    expect(await prisma.improvementAttempt.count({ where: { improvement: { projectId } } })).toBe(0)
    const directory = 'test-results/runtime/mcp-bridge-' + userId
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'observations.json'), JSON.stringify({ connections, bridgeHolds,
      client: '@modelcontextprotocol/client 2.3.1 over its StdioClientTransport and the packed CLI bridge',
      nativeHttpToCompiledApplication: true, scopedReadOnlyKey: true, missingSitePreservesToolError: true,
      cancellationGate: 'Controlled local HTTP exchange held before compiled-route admission; SDK abort physically closes only that exchange',
      writeRefusedWithoutEffect: true, browserSession: false, realProvidersUsed: false, productionChanged: false,
    }, null, 2))
    writeFileSync(join(directory, 'worker.log'), output)
  }, 60_000)

  it.skipIf(!pageSpeedProof)('persists actual PageSpeed measurements through compiled public admission, worker and Site projection', async () => {
    const startedAt = new Date().toISOString(), target = 'https://example.com/'
    const response = await fetch(webOrigin + '/api/checks', { method: 'POST', headers: { 'content-type': 'application/json', origin: webOrigin },
      body: JSON.stringify({ url: target, mode: 'single', source: 'bounded_pagespeed_verification' }) })
    const admitted = await response.json()
    const directory = 'test-results/runtime/compiled-pagespeed-' + userId
    mkdirSync(directory, { recursive: true })
    try {
    expect(response.ok, JSON.stringify(admitted)).toBe(true)
    const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    await vi.waitFor(async () => {
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: admitted.reportId } }))
        .toMatchObject({ status: 'COMPLETED' })
    }, { timeout: 180_000, interval: 500 })
    const tasks = await prisma.auditExecutionTask.findMany({ where: { auditId: admitted.reportId, workKind: 'pagespeed' },
      select: { id: true, workState: true, workInput: true, workAttempts: true, workResult: true } })
    expect(tasks).toHaveLength(2)
    const measurements = tasks.map(task => {
      expect(task).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
      const artifact = speedArtifactSchema.parse(readArtifact(task.workResult, 'pagespeed').data)
      const data = artifact.desktop ?? artifact.mobile
      expect(data).not.toBeNull()
      const measurement = performanceMeasurementSchema.parse(data!.diagnostics.measurement)
      expect(measurement).toMatchObject({ source: 'google-pagespeed', strategy: data!.strategy, formFactor: data!.strategy })
      expect(measurement.scope).not.toBeNull()
      expect(typeof data!.score).toBe('number')
      expect(typeof data!.lcp).toBe('number')
      expect(typeof data!.cls).toBe('number')
      return { taskId: task.id, score: data!.score, lcp: data!.lcp, cls: data!.cls, inp: data!.inp, crux: data!.crux, measurement }
    })
    expect(measurements.map(row => row.measurement.strategy).sort()).toEqual(['desktop', 'mobile'])
    const checked = await prisma.auditExecutionTask.findMany({ where: { auditId: admitted.reportId, workKind: 'check', workState: 'COMPLETED' },
      select: { workInput: true, workResult: true } })
    const receipts = checked.filter(task => ['performance', 'mobile'].includes((task.workInput as { module: string }).module))
      .map(task => checkArtifactSchema.parse(readArtifact(task.workResult, 'check').data).receipt)
    expect(receipts.some(receipt => receipt.assertions.some(assertion => assertion.complete))).toBe(true)
    const projected = await fetch(webOrigin + '/api/sites/' + admitted.siteId, { headers: { cookie } })
    expect(projected.ok).toBe(true)
    const site = siteHomeViewSchema.parse(await projected.json())
    expect(site.audit.id).toBe(admitted.reportId)
    expect(site.cards.find(card => card.id === 'performance')?.sources).toEqual([SITE_BOARD_COPY.pageSpeedSource])
    const requests = ['desktop', 'mobile'].map(strategy => JSON.parse(readFileSync(pageSpeedObservation + strategy + '.json', 'utf8')))
    expect(requests.every(request => request.status === 200)).toBe(true)
    expect(!output.includes(process.env.COMPILED_PAGESPEED_API_KEY!)).toBe(true)
    writeFileSync(join(directory, 'observations.json'), JSON.stringify({ startedAt, completedAt: new Date(), target,
      auditId: admitted.reportId, siteId: admitted.siteId, requests, measurements, receipts,
      projectedPerformanceCard: site.cards.find(card => card.id === 'performance'),
      realProviderUsed: true, providerRequests: 2, productionChanged: false, actualRepairProven: false,
    }, null, 2))
    writeFileSync(join(directory, 'worker.log'), output.replaceAll(process.env.COMPILED_PAGESPEED_API_KEY!, '[redacted]'))
    } finally {
      const requests = ['desktop', 'mobile'].flatMap(strategy => {
        const path = pageSpeedObservation + strategy + '.json'
        return existsSync(path) ? [JSON.parse(readFileSync(path, 'utf8'))] : []
      })
      const audit = admitted.reportId ? await prisma.audit.findUnique({ where: { id: admitted.reportId },
        select: { status: true, errorMsg: true, reportCompleteness: true, performanceData: true } }) : null
      writeFileSync(join(directory, 'retained-provider-state.json'), JSON.stringify({ requests, audit }, null, 2)
        .replaceAll(process.env.COMPILED_PAGESPEED_API_KEY!, '[redacted]'))
    }
  }, 210_000)

  it.skipIf(!settingsProof)('retains Settings drafts through native history and reconciles saves after route unmount', async () => {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ baseURL: webOrigin, viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
    await context.route('**/*', route => {
      const target = new URL(route.request().url())
      return ['http:', 'https:'].includes(target.protocol) && !['localhost', '127.0.0.1'].includes(target.hostname)
        ? route.abort('blockedbyclient') : route.continue()
    })
    const page = await context.newPage(), errors: string[] = [], dialogs: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => { dialogs.push(dialog.type()); void dialog.dismiss() })
    const ac = AUTH.settings.account, C = NOTIFICATIONS_COPY
    const directory = 'test-results/browser/settings-drafts-' + userId
    mkdirSync(directory, { recursive: true })
    let releasePreference: (() => void) | undefined
    await context.tracing.start({ screenshots: true, snapshots: true })
    try {
      await page.goto('/sign-in?next=/settings')
      await page.getByLabel('Email', { exact: true }).fill(userId + '@example.test')
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await page.waitForURL(location => location.pathname === '/settings')
      const originalName = await page.getByLabel(ac.nameLabel, { exact: true }).inputValue()
      const originalZone = await page.getByLabel(C.timeZone, { exact: true }).inputValue()
      const zone = originalZone === 'Africa/Casablanca' ? 'Europe/Paris' : 'Africa/Casablanca'
      await page.getByRole('link', { name: C.manageSites, exact: true }).click()
      await page.waitForURL(location => location.pathname === '/dashboard')
      await page.getByRole('button', { name: 'Account menu', exact: true }).first().click()
      await page.getByRole('menuitem', { name: SITE_SETTINGS_COPY.accountSettings, exact: true }).click()
      await page.waitForURL(location => location.pathname === '/settings')
      const documentId = await page.evaluate(() => {
        const id = crypto.randomUUID()
        document.documentElement.dataset.settingsFixtureDocument = id
        return id
      })
      await page.getByLabel(ac.nameLabel, { exact: true }).fill('Retained profile draft')
      await page.getByLabel(C.timeZone, { exact: true }).fill(zone)
      await page.goBack()
      await page.waitForURL(location => location.pathname === '/dashboard')
      await page.goForward()
      await page.waitForURL(location => location.pathname === '/settings')
      await browserExpect(page.getByLabel(ac.nameLabel, { exact: true })).toHaveValue('Retained profile draft')
      await browserExpect(page.getByLabel(C.timeZone, { exact: true })).toHaveValue(zone)
      expect(await page.evaluate(() => document.documentElement.dataset.settingsFixtureDocument)).toBe(documentId)

      const profilePath = '**/api/auth/update-user'
      await page.route(profilePath, route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Controlled local save failure' }) }))
      await page.getByRole('button', { name: ac.saveCta, exact: true }).click()
      await browserExpect(page.getByText('Controlled local save failure', { exact: true })).toBeVisible()
      await browserExpect(page.getByLabel(ac.nameLabel, { exact: true })).toHaveValue('Retained profile draft')
      await browserExpect(page.getByLabel(C.timeZone, { exact: true })).toHaveValue(zone)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name ?? '').toBe(originalName)
      await page.unroute(profilePath)
      await page.getByRole('button', { name: ac.saveCta, exact: true }).click()
      await vi.waitFor(async () => expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name).toBe('Retained profile draft'))
      await browserExpect(page.getByRole('button', { name: ac.saveCta, exact: true })).toBeDisabled()
      await browserExpect(page.getByRole('button', { name: C.save, exact: true })).toBeEnabled()
      await browserExpect(page.getByLabel(C.timeZone, { exact: true })).toHaveValue(zone)

      await page.getByLabel(ac.nameLabel, { exact: true }).fill('Discard this later edit')
      await page.getByRole('link', { name: C.manageSites, exact: true }).click()
      const decision = page.getByRole('dialog', { name: ac.unsavedTitle, exact: true })
      await browserExpect(decision).toBeVisible()
      await decision.getByRole('button', { name: ac.unsavedStay, exact: true }).click()
      await browserExpect(page.getByLabel(ac.nameLabel, { exact: true })).toHaveValue('Discard this later edit')
      await browserExpect(page.getByLabel(C.timeZone, { exact: true })).toHaveValue(zone)
      await page.getByRole('link', { name: C.manageSites, exact: true }).click()
      await decision.getByRole('button', { name: ac.unsavedLeave, exact: true }).click()
      await page.waitForURL(location => location.pathname === '/dashboard')
      await page.goBack()
      await page.waitForURL(location => location.pathname === '/settings')
      await browserExpect(page.getByLabel(ac.nameLabel, { exact: true })).toHaveValue('Retained profile draft')
      await browserExpect(page.getByLabel(C.timeZone, { exact: true })).toHaveValue(originalZone)

      let release!: () => void, admitted!: () => void
      const gate = new Promise<void>(resolve => { release = resolve })
      releasePreference = release
      const saving = new Promise<void>(resolve => { admitted = resolve })
      await page.route('**/api/me/preferences', async route => {
        if (route.request().method() !== 'PATCH') return route.continue()
        admitted(); await gate; await route.continue()
      })
      await page.getByLabel(C.timeZone, { exact: true }).fill(zone)
      await page.getByRole('button', { name: C.save, exact: true }).click()
      await saving
      await page.goBack()
      await page.waitForURL(location => location.pathname === '/dashboard')
      release()
      await vi.waitFor(async () => expect(await prisma.notificationPreference.findUnique({ where: { userId } })).toMatchObject({ timeZone: zone }))
      await page.goForward()
      await page.waitForURL(location => location.pathname === '/settings')
      await browserExpect(page.getByLabel(C.timeZone, { exact: true })).toHaveValue(zone)
      await browserExpect(page.getByRole('button', { name: C.save, exact: true })).toBeDisabled()
      await page.reload()
      await browserExpect(page.getByLabel(C.timeZone, { exact: true })).toHaveValue(zone)
      await browserExpect(page.getByRole('button', { name: C.save, exact: true })).toBeDisabled()
      expect(dialogs).toEqual([])
      expect(errors).toEqual([])
      await page.screenshot({ path: join(directory, 'settings-after-save.png'), fullPage: true })
      writeFileSync(join(directory, 'observations.json'), JSON.stringify({ nativeHistoryRetainsBothDrafts: true,
        clientDocumentRetained: true, failedSaveRetainsDrafts: true, independentFormSave: true,
        stayRetainsBoth: true, leaveDiscardsBoth: true, persistedSaveAfterUnmount: true,
        authoritativeReturnClearsDraft: true, cleanReloadWithoutUnloadWarning: true,
        runtimeErrors: errors, nativeDialogs: dialogs, realProvidersUsed: false, productionChanged: false,
      }, null, 2))
    } finally {
      releasePreference?.()
      await page.unrouteAll({ behavior: 'wait' })
      await context.tracing.stop({ path: join(directory, 'trace.zip') })
      await context.close(); await browser.close()
      writeFileSync(join(directory, 'worker.log'), output)
    }
  }, 90_000)

  it.skipIf(!operationsProof)('reports a retained failed summary through the compiled operational endpoints and clears only its settled gap', async () => {
    const now = new Date()
    await prisma.notificationPreference.create({ data: { userId, cadence: 'WEEKLY', nextSendAt: new Date(now.getTime() + 7 * 86400_000) } })
    // A retained exhausted receipt cannot be retried or skipped by this fixture's
    // worker sweep. These rows prove health projection, not provider delivery.
    const receipt = await prisma.notificationDigest.create({ data: { userId, revision: 0, scheduledAt: now,
      status: 'FAILED', attempts: 5, nextAttemptAt: now } })
    const read = async (path: string) => {
      const response = await fetch(webOrigin + path, { signal: AbortSignal.timeout(5000) })
      return { status: response.status, body: await response.json() }
    }
    await vi.waitFor(async () => expect(await read('/api/health/operational')).toEqual({
      status: 503, body: { ok: false, status: 'monitoring_gaps' },
    }), { timeout: 10_000 })
    const failed = await read('/api/health/worker')
    expect(failed).toMatchObject({ status: 200, body: { ok: false, status: 'monitoring_gaps', monitoring: { unsettledSummaries: 1 } } })
    expect(await prisma.notificationDigest.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(receipt)
    await prisma.notificationDigest.update({ where: { id: receipt.id }, data: { status: 'SENT', sentAt: new Date(), providerId: randomUUID() } })
    await vi.waitFor(async () => expect(await read('/api/health/operational')).toEqual({ status: 200, body: { ok: true, status: 'ok' } }), { timeout: 10_000 })
    expect(await read('/api/health/worker')).toMatchObject({ status: 200, body: { ok: true, monitoring: { unsettledSummaries: 0 } } })
    const directory = 'test-results/runtime/summary-operations-' + userId
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'observations.json'), JSON.stringify({ receiptId: receipt.id,
      operationalFailureHttp: 503, operationalRecoveryHttp: 200, compatibilityDiagnosticHttp: 200,
      originalFailedReceiptRetainedByReads: true, settledGapCleared: true,
      providerAcceptanceSimulatedByStoredState: true, realProvidersUsed: false, productionChanged: false,
    }, null, 2))
    writeFileSync(join(directory, 'worker.log'), output)
  }, 45_000)

  it('collects a native failure and independently verifies repair using the compiled parser and consumers', async () => {
    const source = webProof ? await http('/api/sites/' + projectId + '/runs', { scope: 'category', area: 'accessibility' }, 'compiled-source')
      : await requestSiteRun({ projectId, userId, scope: 'CATEGORY', categoryArea: 'accessibility',
        source: 'WEB', outcomeIds: [], idempotencyKey: 'compiled-source' })
    await complete(source.auditId!)
    expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: source.auditId!, targetKey: 'task:p0:browser', workKind: 'browser' } }))
      .toMatchObject({ workState: 'COMPLETED', workResult: { kind: 'browser', data: { metadata: { title: 'Compiled worker fixture' } } } })
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'buttons-no-text' } })
    expect(flag.evidenceTargets).toEqual(expect.arrayContaining([expect.objectContaining({ context: expect.stringContaining('accessibility:axe:desktop:') })]))
    const panel = webProof ? siteFlagPanelSchema.parse(await http('/api/sites/' + projectId + '/flags/' + flag.id)) : null
    if (panel) {
      expect(panel.flag).toMatchObject({ sourceFlagId: flag.id, sourceAuditId: source.auditId })
      expect(panel.flag.id).toBe((await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })).improvementId)
    }
    const fix = webProof ? null : await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'compiled-fix',
      changeSummary: 'Name the action control' })
    repaired = true
    const verification = webProof ? await http('/api/sites/' + projectId + '/flags/' + panel!.flag.id + '/verify',
      { changeSummary: 'Name the action control' }, 'compiled-verify')
      : await requestSiteRun({ projectId, userId, source: 'WEB', outcomeIds: [], idempotencyKey: 'compiled-verify',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: url, checkId: flag.checkId!, parentAuditId: source.auditId!, attemptId: fix!.attemptId } })
    await complete(webProof ? verification.verificationAuditId : verification.auditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix?.attemptId ?? verification.attemptId } }))
      .toMatchObject({ outcome: 'IMPROVED', comparable: true })
    const resolved = await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })
    expect(resolved).toMatchObject({ status: 'FIXED' })
    if (panel) {
      expect(siteFlagPanelSchema.parse(await http('/api/sites/' + projectId + '/flags/' + panel.flag.id)).flag)
        .toMatchObject({ id: panel.flag.id, sourceFlagId: flag.id, status: resolved.status, verifying: false })
      expect(await http('/api/sites/' + projectId + '/flags/' + panel.flag.id + '/verify',
        { changeSummary: 'Name the action control' }, 'compiled-verify'))
        .toMatchObject({ runId: verification.runId, verificationAuditId: verification.verificationAuditId, attemptId: verification.attemptId })
      expect(await prisma.improvementAttempt.count({ where: { improvementId: panel.flag.id } })).toBe(1)
    }
  }, 90_000)

  it.skipIf(!sharedWatchProof)('delivers a scheduled alert from shared manual work through the compiled worker and native SDK', async () => {
    await prisma.user.update({ where: { id: userId }, data: { email: mailRecipient } })
    await prisma.project.update({ where: { id: projectId }, data: { watchPausedAt: null, notificationLevel: 'FLAGS',
      watchNextRunAt: new Date(Date.now() - 60_000) } })
    await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, kind: 'AVAILABILITY' } })
    sharedWatchGateOpen = false
    const manual = await http('/api/sites/' + projectId + '/runs', { scope: 'outcomes', outcomeIds: [outcome.id] }, 'shared-watch-manual')
    await vi.waitFor(() => expect(heldWatchResponses.length).toBeGreaterThan(0), { timeout: 15_000, interval: 50 })
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: manual.runId } })).toMatchObject({
      source: 'WEB', context: { scheduled: { version: 1 } } })
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
    sharedWatchGateOpen = true
    heldWatchResponses.splice(0).forEach(release => release())
    await complete(manual.auditId)
    const recorded = await prisma.runRequest.findUniqueOrThrow({ where: { id: manual.runId }, include: { assessments: true } })
    expect(recorded.assessments).toMatchObject([{ outcomeId: outcome.id, state: 'FLAG' }])
    const incident = await prisma.flag.findFirstOrThrow({ where: { auditId: manual.auditId, fingerprint: { startsWith: 'outcome:v1:' } } })
    await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId } }), output)
      .toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationAttempts: 1 }), { timeout: 75_000, interval: 250 })
    const alert = await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId } })
    expect(alert).toMatchObject({ recheckTrigger: original.recheckTrigger, skipUsageCount: original.skipUsageCount,
      watchNotificationProviderId: mailProviderId })
    expect(alert.watchRegressionCount).toBeGreaterThan(0)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchLastRunAt).toEqual(alert.completedAt)
    const sent = mailRequests.filter(request => (request.body.tags as Array<{ name: string; value: string }> | undefined)
      ?.some(tag => tag.name === 'purpose' && tag.value === 'watch'))
    expect(sent).toHaveLength(1)
    expect([sent[0].body.to].flat()).toEqual([mailRecipient])
    expect(sent[0].body.text).toContain('/sites/' + projectId)
    expect(siteHomeViewSchema.parse(await http('/api/sites/' + projectId)).watch.alert).toMatchObject({ state: 'accepted', status: 'SENT' })
    const directory = 'test-results/runtime/compiled-shared-watch-' + userId
    mkdirSync(directory, { recursive: true })
    writeFileSync(directory + '/receipt.json', JSON.stringify({ runId: manual.runId, auditId: manual.auditId, flagId: incident.id,
      actualHttpObservation: 503, nativeAssessment: 'FLAG', originalSource: recorded.source, originalTrigger: original.recheckTrigger,
      sameExecutionShared: true, scheduledReceipt: true, workerTimerDelivered: true, recordedProviderAcceptance: true,
      controlledProviderRequests: sent.length, realProviderUsed: false, actualInboxDelivery: false, productionChanged: false }, null, 2))
  }, 120_000)

  it.skipIf(!notificationProof)('sends scheduled summaries through the native SDK and reconciles signed delivery in the compiled application', async () => {
    const source = await http('/api/sites/' + projectId + '/runs', { scope: 'category', area: 'accessibility' }, 'notification-source')
    await complete(source.auditId)
    const home = siteHomeViewSchema.parse(await http('/api/sites/' + projectId))
    expect(home.presentation.flags.count).toBeGreaterThan(0)
    await prisma.user.update({ where: { id: userId }, data: { email: mailRecipient } })
    await prisma.project.update({ where: { id: projectId }, data: { watchPausedAt: null, notificationLevel: 'FLAGS',
      watchNextRunAt: new Date(Date.now() + 7 * 86400_000) } })
    const due = { cadence: 'DAILY' as const, nextSendAt: new Date(Date.now() - 60_000) }
    await prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...due }, update: due })
    const directory = 'test-results/runtime/compiled-notifications-' + userId
    mkdirSync(directory, { recursive: true })
    await vi.waitFor(async () => {
      if (worker!.exitCode !== null) throw new Error(output)
      expect(await prisma.notificationDigest.findFirst({ where: { userId } }), output)
        .toMatchObject({ status: 'FAILED', attempts: 1 })
    }, { timeout: 75_000, interval: 500 })
    const failed = await prisma.notificationDigest.findFirstOrThrow({ where: { userId } })
    expect(failed.nextAttemptAt.getTime()).toBeGreaterThan(Date.now())
    expect(earlyEventStatus).toBe(200)
    expect(await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: earlyEventId } })).toMatchObject({ processedAt: null })
    expect(await prisma.emailDelivery.findUnique({ where: { providerId: mailProviderId } })).toBeNull()
    expect(mailRequests).toHaveLength(1)
    expect(mailRequests[0].key).toBe('fixflags-summary-' + failed.id)
    expect(Object.keys(mailRequests[0].body).sort()).toEqual(['from', 'html', 'subject', 'tags', 'text', 'to'])
    expect([mailRequests[0].body.to].flat()).toEqual([mailRecipient])
    expect(mailRequests[0].body.text).toContain(NOTIFICATIONS_COPY.summary.problems(home.presentation.flags.count))
    expect(mailRequests[0].body.text).not.toContain(NOTIFICATIONS_COPY.summary.quiet)
    expect(mailRequests[0].body.text).toContain(webOrigin + '/sites/' + projectId)
    console.info('Compiled notification: lost response and early signed event recorded')
    // Advance only this fixture's retry eligibility. The worker's real timer,
    // database claim, capacity admission and SDK own the subsequent delivery.
    await prisma.notificationDigest.update({ where: { id: failed.id }, data: { nextAttemptAt: new Date(0) } })
    await vi.waitFor(async () => {
      expect(await prisma.notificationDigest.findUniqueOrThrow({ where: { id: failed.id } }), output)
        .toMatchObject({ status: 'SENT', attempts: 2, providerId: mailProviderId })
      expect(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: mailProviderId } }))
        .toMatchObject({ userId, sourceId: failed.id, channel: 'summary', deliveredAt: expect.any(Date) })
    }, { timeout: 75_000, interval: 500 })
    expect(mailRequests).toHaveLength(2)
    expect(mailRequests[1]).toEqual(mailRequests[0])
    const accepted = await prisma.notificationDigest.findUniqueOrThrow({ where: { id: failed.id } })
    expect(accepted.payload).toEqual(failed.payload)
    console.info('Compiled notification: identical SDK retry accepted and delivery reconciled')
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ baseURL: webOrigin })
    await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
      ? route.continue() : route.abort('blockedbyclient'))
    await context.addCookies(sessionCookie.split('; ').map(cookie => {
      const split = cookie.indexOf('=')
      return { name: cookie.slice(0, split), value: cookie.slice(split + 1), url: webOrigin }
    }))
    const page = await context.newPage()
    try {
      await page.goto('/settings')
      const history = page.getByRole('region', { name: NOTIFICATIONS_COPY.history, exact: true })
      await browserExpect(history.getByText(NOTIFICATIONS_COPY.delivery.delivered, { exact: true })).toBeVisible()
      expect((await deliveryEvent('email.bounced', randomUUID(), false)).status).toBe(400)
      expect((await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: mailProviderId } })).bouncedAt).toBeNull()
      expect((await deliveryEvent('email.bounced')).status).toBe(200)
      await page.reload()
      await browserExpect(history.getByText(NOTIFICATIONS_COPY.delivery.bounced, { exact: true })).toBeVisible()
      await browserExpect(page.getByText(NOTIFICATIONS_COPY.blocked, { exact: true })).toBeVisible()
      await prisma.notificationPreference.update({ where: { userId }, data: { nextSendAt: new Date() } })
      await vi.waitFor(async () => {
        expect(await prisma.notificationDigest.findFirst({ where: { userId, status: 'SKIPPED' } }), output)
          .toMatchObject({ attempts: 0, providerId: null })
      }, { timeout: 75_000, interval: 500 })
      expect(mailRequests).toHaveLength(2)
      console.info('Compiled notification: signed bounce suppressed the next scheduled summary')
      await page.screenshot({ path: directory + '/settings-suppressed.png', fullPage: true })
      writeFileSync(directory + '/observations.json', JSON.stringify({ scope: 'compiled web and worker with disposable services and local provider HTTP',
        nativeCategorySourceAuditId: source.auditId, summaryReceiptId: failed.id, providerId: mailProviderId,
        naturalWorkerTimer: true, dueScheduleSeededInFixture: true, calendarSlotObserved: false,
        retryEligibilityAdvancedInFixture: true, nativeSdkRequestCount: mailRequests.length,
        frozenBodyAndKeyReplayed: true, earlySignedDeliveryReconciled: true, invalidSignatureRefused: true,
        visibleDeliveredThenBounced: true, subsequentSummarySuppressed: true,
        realProviderUsed: false, actualEmailDelivered: false, productionChanged: false }, null, 2))
    } finally { await browser.close() }
  }, 300_000)

  it.skipIf(!publicEntryProof)('admits a real public URL through the homepage and claims its native evidence', async () => {
    const target = 'https://example.com/'
    if (!signupProof) {
    await prisma.user.create({ data: { id: publicUserId, email: publicUserId + '@example.test', emailVerified: true, role: 'user' } })
    await prisma.account.create({ data: { userId: publicUserId, accountId: publicUserId, providerId: 'credential', password: await hashPassword(password) } })
    }
    const directory = 'test-results/browser/public-entry-' + userId
    mkdirSync(directory, { recursive: true })
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ baseURL: webOrigin, viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
    await context.route('**/*', route => {
      const destination = new URL(route.request().url())
      return ['http:', 'https:'].includes(destination.protocol) && !['localhost', '127.0.0.1'].includes(destination.hostname)
        ? route.abort('blockedbyclient') : route.continue()
    })
    const page = await context.newPage()
    await context.tracing.start({ screenshots: true, snapshots: true })
    try {
      await page.goto('/')
      await page.getByRole('textbox', { name: 'Website URL' }).first().fill(target)
      const submitted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/checks' && response.request().method() === 'POST')
      await page.getByRole('button', { name: CARE_HOME.hero.cta, exact: true }).first().click()
      const response = await submitted, admitted = await response.json()
      expect(response.ok(), JSON.stringify(admitted) + '\n' + output).toBe(true)
      expect(admitted.siteId).toEqual(expect.any(String))
      const provisionalId = admitted.siteId
      await page.waitForURL(location => location.pathname === '/sites/' + provisionalId)
      const read = async () => {
        const result = await page.evaluate(async path => {
          const response = await fetch(path, { cache: 'no-store' })
          return { ok: response.ok, data: await response.json() }
        }, '/api/sites/' + provisionalId)
        expect(result.ok, JSON.stringify(result.data) + '\n' + output).toBe(true)
        return siteHomeViewSchema.parse(result.data)
      }
      const visitor = await read()
      expect(visitor.actions.ownership).toBe('provisional')
      expect(new URL(visitor.site.url).href).toBe(target)
      const auditId = visitor.audit.id!
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ status: 'COMPLETED' })
      }, { timeout: 120_000, interval: 250 })
      const collected = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId, targetKey: 'task:p0:browser', workKind: 'browser', workState: 'COMPLETED' },
        select: { id: true, workResult: true } })
      expect(collected.workResult).toMatchObject({ kind: 'browser', data: { metadata: { title: 'Example Domain' } } })
      const beforeClaim = await read()
      const sourceFlags = beforeClaim.flags.map(flag => flag.id).sort()
      const sourcePages = await prisma.auditPage.findMany({ where: { auditId }, select: { id: true }, orderBy: { id: 'asc' } })
      await page.goto((signupProof ? '/sign-up' : '/sign-in') + '?next=' + encodeURIComponent('/sites/' + provisionalId))
      await page.getByLabel('Email', { exact: true }).fill(signupProof ? mailRecipient : publicUserId + '@example.test')
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: signupProof ? AUTH.signUp.cta : AUTH.signIn.cta, exact: true }).click()
      if (signupProof) {
        await browserExpect(page.getByRole('heading', { name: AUTH.emailVerification.title })).toBeVisible()
        const account = await prisma.user.findUniqueOrThrow({ where: { email: mailRecipient } })
        fixtureUsers.push(account.id)
        expect(account.emailVerified).toBe(false)
        expect(await prisma.session.count({ where: { userId: account.id } })).toBe(0)
        expect((await read()).actions.ownership).toBe('provisional')
        await page.screenshot({ path: directory + '/verification-pending.png', fullPage: true })
        const messages = () => mailRequests.filter(request => [request.body.to].flat().includes(mailRecipient) &&
          typeof request.body.text === 'string' && request.body.text.includes('/api/auth/verify-email?'))
        await vi.waitFor(() => expect(messages()).toHaveLength(1))
        await page.getByRole('button', { name: AUTH.emailVerification.resend, exact: true }).click()
        await browserExpect(page.getByText(AUTH.emailVerification.resent, { exact: true })).toBeVisible()
        await vi.waitFor(() => expect(messages()).toHaveLength(2))
        const link = new URL((messages().at(-1)!.body.text as string).match(/https?:\/\/\S+/)![0])
        expect(link.origin).toBe(webOrigin)
        expect(link.pathname).toBe('/api/auth/verify-email')
        expect(link.searchParams.get('callbackURL')).toBe('/post-login?next=' + encodeURIComponent('/sites/' + provisionalId))
        await page.goto(link.href)
        await vi.waitFor(async () => expect(await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({ emailVerified: true }))
      }
      await page.waitForURL(location => location.pathname.startsWith('/sites/'), { timeout: 30_000 })
      const claimed = await read()
      expect(claimed.actions.ownership).toBe('owner')
      expect(claimed.audit.id).toBe(auditId)
      expect(claimed.flags.map(flag => flag.id).sort()).toEqual(sourceFlags)
      expect(await prisma.auditPage.findMany({ where: { auditId }, select: { id: true }, orderBy: { id: 'asc' } })).toEqual(sourcePages)
      expect(claimed.watch.interval).not.toBeNull()
      expect(claimed.uptime?.enabled).toBe(true)
      expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: visitor.site.provisionalSiteId! } }))
        .toMatchObject({ claimedProjectId: claimed.site.projectId, primaryAuditId: auditId })
      writeFileSync(directory + '/observations.json', JSON.stringify({ target, ordinaryUrlEntry: true,
        transport: 'real public DNS, TLS and response, limited to GET or HEAD of the exact target',
        scope: 'local compiled application and worker, disposable database and Redis',
        sourceAuditId: auditId, nativeCollectionTaskId: collected.id, sameEvidenceClaimed: true,
        defaultMonitoring: true, providerTransport: 'refused',
        fixtureAccount: signupProof ? 'ordinary browser signup, installed mail SDK with controlled loopback acceptance, native verification link and automatic sign-in'
          : 'verified account seeded locally, not signup or email delivery proof',
        signupVerificationRequired: signupProof, actualInboxDelivery: false,
        externalRepairVerified: false, productionChanged: false }, null, 2))
    } finally {
      await page.screenshot({ path: directory + '/last-state.png', fullPage: true }).catch(() => {})
      await context.tracing.stop({ path: directory + '/trace.zip' })
      await browser.close()
    }
  }, 180_000)

  it.skipIf(!browserProof)('uses ordinary browser sign-in, native clipboard and visible independent repair with recurrence', async () => {
    repaired = false
    await prisma.user.create({ data: { id: browserUserId, email: browserUserId + '@example.test', emailVerified: true, role: 'user' } })
    const fixturePassword = await hashPassword(password)
    const legacyCredential = await prisma.account.create({ data: { userId: browserUserId,
      accountId: browserUserId + '@example.test', providerId: 'credential', password: fixturePassword } })
    const credential = await ensureReleasePasswordAccount(prisma, { userId: browserUserId, email: browserUserId + '@example.test', passwordHash: fixturePassword })
    expect(credential).toMatchObject({ id: legacyCredential.id, accountId: browserUserId, userId: browserUserId })
    expect(await prisma.account.count({ where: { userId: browserUserId, providerId: 'credential' } })).toBe(1)
    const directory = 'test-results/browser/site-plan-' + userId
    mkdirSync(directory, { recursive: true })
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ baseURL: webOrigin, permissions: ['clipboard-read', 'clipboard-write'],
      viewport: { width: 1280, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' })
    await context.route('**/*', route => {
      const target = new URL(route.request().url())
      return ['http:', 'https:'].includes(target.protocol) && !['localhost', '127.0.0.1'].includes(target.hostname)
        ? route.abort('blockedbyclient') : route.continue()
    })
    const page = await context.newPage()
    const runtimeErrors: string[] = []
    page.on('pageerror', error => runtimeErrors.push(error.message))
    const accessibility: Array<{ surface: string; theme: string; width: number; failures: string[]; approvedContrastCount: number }> = []
    const browserHttp = async (path: string, body?: object, key?: string) => {
      const result = await page.evaluate(async ({ path, body, key }) => {
        const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store',
          headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}) })
        return { ok: response.ok, status: response.status, data: await response.json() }
      }, { path, body, key })
      expect(result.ok, JSON.stringify(result.data)).toBe(true)
      return result.data
    }
    await context.tracing.start({ screenshots: true, snapshots: true })
    try {
      await page.goto('/')
      await page.getByRole('textbox', { name: 'Website URL' }).first().fill(url)
      await page.getByRole('button', { name: CARE_HOME.hero.cta, exact: true }).first().click()
      await browserExpect(page.getByText(AUDIT_ERRORS.urlLocalhost, { exact: true })).toBeVisible()
      const consent = page.getByRole('dialog', { name: 'Choose your analytics settings' })
      if (await consent.isVisible()) await consent.getByRole('button', { name: 'Only necessary', exact: true }).click()
      // Production input correctly refuses loopback. Existing explicit local
      // admission supports the fixture without weakening that customer policy.
      const admitted = await browserHttp('/api/checks', { url, source: 'homepage' })
      expect(admitted.siteId).toEqual(expect.any(String))
      const provisionalId = admitted.siteId
      await page.goto('/sites/' + provisionalId)
      const visitor = siteHomeViewSchema.parse(await browserHttp('/api/sites/' + provisionalId))
      expect(visitor.actions.ownership).toBe('provisional')
      const initialAuditId = visitor.audit.id!
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: initialAuditId } })).toMatchObject({ status: 'COMPLETED' })
      }, { timeout: 90_000, interval: 250 })
      const publicResult = siteHomeViewSchema.parse(await browserHttp('/api/sites/' + provisionalId))
      expect(publicResult.flags.every(flag => !flag.fix)).toBe(true)
      await page.goto('/sign-in?next=' + encodeURIComponent('/sites/' + provisionalId))
      await page.getByLabel('Email', { exact: true }).fill(browserUserId + '@example.test')
      await page.getByLabel('Password', { exact: true }).fill(password)
      const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/sign-in/email' && response.request().method() === 'POST')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      expect((await signedIn).status()).toBe(200)
      await page.waitForURL(location => location.pathname.startsWith('/sites/'), { timeout: 30_000 })
      const claimed = siteHomeViewSchema.parse(await browserHttp('/api/sites/' + provisionalId))
      expect(claimed.actions.ownership).toBe('owner')
      expect(claimed.audit.id).toBe(initialAuditId)
      const claimedProjectId = claimed.site.projectId!
      expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: visitor.site.provisionalSiteId! } }))
        .toMatchObject({ claimedProjectId, primaryAuditId: initialAuditId })
      expect(claimedProjectId).not.toBe(projectId)
      expect(claimed.watch.interval).not.toBeNull()
      expect(claimed.uptime?.enabled).toBe(true)
      expect(claimed.cards.find(card => card.id === 'performance')?.state).toBe('unknown')
      const availability = claimed.outcomes.find(outcome => outcome.kind === 'AVAILABILITY' && outcome.bindings.some(binding => binding.required))!
      expect(availability).toBeTruthy()
      await page.goto(`/sites/${claimedProjectId}/outcomes/${availability.id}`)
      const outcomeCheck = page.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true })
      await browserExpect(outcomeCheck).toBeEnabled()
      const outcomeResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/outcomes/${availability.id}/verify`) && response.request().method() === 'POST')
      await outcomeCheck.click()
      const outcomeAccepted = await outcomeResponse
      expect(outcomeAccepted.ok()).toBe(true)
      await complete((await outcomeAccepted.json()).auditId)
      const outcomeSection = page.locator('section').filter({ has: page.getByText(OUTCOME_DETAIL_COPY.state, { exact: true }) })
      await browserExpect(outcomeSection.getByRole('status').first()).toHaveText(outcomeStatusLabel('CLEAR', false), { timeout: 15_000 })
      await browserExpect(outcomeCheck).toBeEnabled()
      await page.screenshot({ path: directory + '/outcome-verified.png', fullPage: true })
      const flag = claimed.flags.find(item => item.checkId === 'buttons-no-text')!
      expect(flag).toBeTruthy()
      const panel = siteFlagPanelSchema.parse(await browserHttp('/api/sites/' + claimedProjectId + '/flags/' + flag.id))
      expect(panel.flag.repairGuidance).toBe('ready')
      await page.goto('/sites/' + claimedProjectId + '?flag=' + panel.flag.id)
      const copy = page.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt, exact: true })
      await browserExpect(copy).toBeVisible()
      const prepared = await browserHttp('/api/sites/' + claimedProjectId + '/flags/' + flag.id + '/fix', { action: 'prepare' })
      writeFileSync(directory + '/repair-task.txt', prepared.prompt)
      expect(prepared.prompt).toContain('Recorded scan: ' + webOrigin + '/report/' + initialAuditId)
      const briefUrl = new URL(prepared.prompt.match(/^Agent-readable repair JSON: (.+)$/m)![1])
      expect(briefUrl.origin).toBe(webOrigin)
      const brief = repairBriefSchema.parse(await browserHttp(briefUrl.pathname + briefUrl.search))
      expect(brief.siteId).toBe(claimedProjectId)
      expect(brief.flag.sourceAuditId).toBe(initialAuditId)
      expect(brief.flag.sourceFlagId).toBe(prepared.sourceFlagId)
      expect(brief.retrieval.mcp.arguments.expectedContextHash).toBe(brief.contextHash)
      expect((await fetch(briefUrl)).status).toBe(404)
      const developerKey = await browserHttp('/api/api-keys', { name: 'Local repair acceptance', client: 'codex',
        scopePreset: 'read_only', expiresInDays: 30 })
      const keyBrief = await fetch(briefUrl, { headers: { Authorization: 'Bearer ' + developerKey.key } })
      expect(keyBrief.status).toBe(200)
      expect(keyBrief.headers.get('Cache-Control')).toBe('private, no-store')
      expect(repairBriefSchema.parse(await keyBrief.json())).toEqual(brief)
      const mcpRequest = async (name: string, args: object) => fetch(webOrigin + '/api/mcp', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json',
          Authorization: 'Bearer ' + developerKey.key, 'MCP-Protocol-Version': MCP_PROTOCOL_VERSION, 'Mcp-Method': 'tools/call', 'Mcp-Name': name },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args, _meta: {
          'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientInfo': { name: 'local-repair-acceptance', version: '1.0.0' },
          'io.modelcontextprotocol/clientCapabilities': {},
        } } }),
      })
      const mcpRead = await mcpRequest(MCP_TOOLS.getFlag.name, brief.retrieval.mcp.arguments)
      expect(mcpRead.status, await mcpRead.clone().text()).toBe(200)
      expect((await mcpRead.json()).result.structuredContent.repairBrief).toEqual(brief)
      const evidenceUrl = new URL(brief.links.evidence)
      const withEvidence = repairBriefSchema.parse(await browserHttp(evidenceUrl.pathname + evidenceUrl.search))
      expect(withEvidence.evidence).toMatchObject({ sourceFlagId: brief.flag.sourceFlagId, sourceAuditId: initialAuditId })
      const mcpEvidence = await mcpRequest(MCP_TOOLS.getFlag.name, brief.retrieval.evidence.arguments)
      expect(mcpEvidence.status, await mcpEvidence.clone().text()).toBe(200)
      expect((await mcpEvidence.json()).result.structuredContent.repairBrief).toEqual(withEvidence)
      const refusedWrite = await mcpRequest(MCP_TOOLS.recordFix.name, { siteId: claimedProjectId, flagId: flag.id,
        idempotencyKey: 'read-only-must-refuse', changeSummary: 'Read-only key cannot claim a change' })
      expect(refusedWrite.status).toBe(403)
      expect((await browserHttp('/api/reports/' + initialAuditId)).id).toBe(initialAuditId)
      await copy.click()
      await browserExpect(page.getByRole('button', { name: SITE_DASHBOARD_COPY.bundleCopied, exact: true })).toBeVisible()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(prepared.prompt)
      expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId: claimedProjectId }, type: 'HANDOFF_COPIED' } })).toBeGreaterThan(0)

      await page.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const verifyDialog = page.getByRole('dialog', { name: SITE_BOARD_COPY.verifyFix, exact: true })
      await verifyDialog.getByRole('textbox', { name: SITE_BOARD_COPY.changeLabel }).fill('Name the existing action control')
      repaired = true
      const accepted = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/verify') && response.request().method() === 'POST')
      await verifyDialog.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const response = await accepted
      expect(response.ok()).toBe(true)
      const verification = await response.json()
      await complete(verification.verificationAuditId)
      await browserExpect(page.getByText(SITE_DASHBOARD_COPY.flagResolved, { exact: true })).toBeVisible({ timeout: 15_000 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: verification.attemptId } }))
        .toMatchObject({ outcome: 'IMPROVED', comparable: true })
      const proof = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: {
        auditId: verification.verificationAuditId, targetKey: 'check:buttons-no-text',
      } })
      expect(proof.taskId).toBeTruthy()
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: proof.taskId! } }))
        .toMatchObject({ auditId: verification.verificationAuditId, workState: 'COMPLETED' })

      // Default monitoring can legitimately win admission after a repair.
      // Observe real settlement instead of disabling it or bypassing its lease.
      await vi.waitFor(async () => {
        expect(siteHomeViewSchema.parse(await browserHttp('/api/sites/' + claimedProjectId)).activeRuns).toEqual([])
      }, { timeout: 40_000, interval: 250 })
      repaired = false
      const recurring = await browserHttp('/api/sites/' + claimedProjectId + '/runs', { scope: 'category', area: 'accessibility' }, 'browser-recurrence')
      await complete(recurring.auditId)
      const recurringFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId, checkId: 'buttons-no-text' } })
      expect((await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurringFlag.id } })).improvementId).toBe(panel.flag.id)
      await browserExpect(page.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt, exact: true })).toBeVisible({ timeout: 15_000 })
      await browserExpect(page.getByText(SITE_DASHBOARD_COPY.flagResolved, { exact: true })).toHaveCount(0)
      await page.screenshot({ path: directory + '/flag-recurred.png', fullPage: true })
      async function inspectSurface(surface: string, theme: string, width: number) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(() => document.fonts.ready)
        await page.mouse.move(0, 0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        if (surface === 'overview') {
          const overlaps = await page.getByRole('article').evaluateAll(rows => rows.flatMap(row => {
            const title = row.querySelector('button[aria-label^="Open "]')
            const action = row.querySelector('[data-site-return-focus="check"]')
            if (!title || !action) return []
            const heading = title.getBoundingClientRect(), control = action.getBoundingClientRect(), card = row.getBoundingClientRect()
            const intersect = Math.min(heading.right, control.right) - Math.max(heading.left, control.left) > 1 &&
              Math.min(heading.bottom, control.bottom) - Math.max(heading.top, control.top) > 1
            return intersect || control.left < card.left || control.right > card.right || control.height < 44
              ? [title.getAttribute('aria-label')] : []
          }))
          expect(overlaps).toEqual([])
        }
        if (width < 768 && surface !== 'flag') {
          const navigation = page.getByRole('navigation', { name: 'Mobile Site', exact: true })
          await browserExpect(navigation).toBeVisible()
          expect(await navigation.locator('a').evaluateAll(links => links.flatMap(link => {
            const target = link.getBoundingClientRect(), label = link.querySelector('span')!
            const text = label.getBoundingClientRect(), line = parseFloat(getComputedStyle(label).lineHeight)
            const hit = document.elementFromPoint(target.left + target.width / 2, target.top + target.height / 2)
            return target.width < 44 || target.height < 44 || label.scrollWidth > label.clientWidth + 1 || text.height > line + 1 || !hit || !link.contains(hit)
              ? [link.textContent] : []
          }))).toEqual([])
        }
        await page.screenshot({ path: `${directory}/${surface}-${theme}-${width}.png`, fullPage: true })
        const result = await new AxeBuilder({ page: page as never }).analyze()
        const inspected = await inspectAccessibilityViolations(page, result.violations)
        accessibility.push({ surface, theme, width, ...inspected })
        writeFileSync(directory + '/accessibility.json', JSON.stringify(accessibility, null, 2))
      }
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') {
          await page.setViewportSize({ width: 1280, height: 900 })
          await page.keyboard.press('Escape')
          await browserExpect(page.getByRole('dialog')).toHaveCount(0)
          await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
          await browserExpect(page.locator('html')).toHaveClass(/\bdark\b/)
          await page.goto('/sites/' + claimedProjectId + '?flag=' + panel.flag.id)
          await browserExpect(page.getByRole('dialog')).toBeVisible()
        }
        for (const width of [320, 375, 768, 1280]) await inspectSurface('flag', theme, width)
      }
      const dialog = page.getByRole('dialog')
      await dialog.locator('button').first().focus()
      for (let step = 0; step < 8; step++) {
        await page.keyboard.press('Tab')
        expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)
      }
      await page.keyboard.press('Escape')
      await browserExpect(dialog).toHaveCount(0)
      await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
      await browserExpect(page.locator('html')).not.toHaveClass(/\bdark\b/)
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') {
          await page.setViewportSize({ width: 1280, height: 900 })
          await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
          await browserExpect(page.locator('html')).toHaveClass(/\bdark\b/)
        }
        for (const surface of ['Overview', 'Pages', 'Timeline', 'Integrations', 'Settings']) {
          await page.setViewportSize({ width: 1280, height: 900 })
          const destination = page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: surface, exact: true })
          await destination.click()
          await browserExpect(destination).toHaveAttribute('aria-current', 'page')
          await browserExpect(page.getByRole('heading', { level: 1 })).toBeVisible()
          for (const width of [1280, 768, 375, 320]) await inspectSurface(surface.toLowerCase(), theme, width)
        }
      }
      // The launch gate is part of the candidate. Component checks exercise the
      // unreleased setup; this compiled journey proves it remains undiscoverable.
      const gatedSetup = await page.goto('/dashboard/mcp-setup?builder=codex')
      expect(gatedSetup?.status()).toBe(404)
      expect(accessibility.flatMap(sample => sample.failures)).toEqual([])
      expect(runtimeErrors).toEqual([])
      // Observe this compiled page on local infrastructure. These are lab
      // timings, without provider metrics or a field-percentile claim.
      await page.addInitScript(() => {
        const sample = { lcpMs: null as number | null, cls: 0, interactionsMs: [] as number[] }
        Object.assign(window, { fixflagsLocalPerformance: sample })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) sample.lcpMs = entry.startTime
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }
            if (!shift.hadRecentInput) sample.cls += shift.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if ((entry as PerformanceEntry & { interactionId: number }).interactionId) sample.interactionsMs.push(entry.duration)
          }
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
      })
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto('/sites/' + claimedProjectId)
      await browserExpect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'Pages', exact: true }).click()
      await browserExpect(page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'Pages', exact: true })).toHaveAttribute('aria-current', 'page')
      await browserExpect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'Overview', exact: true }).click()
      await browserExpect(page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page')
      await browserExpect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const performance = await page.evaluate(() => ({
        ...(window as Window & { fixflagsLocalPerformance?: object }).fixflagsLocalPerformance,
        navigation: JSON.parse(JSON.stringify(window.performance.getEntriesByType('navigation'))),
      }))
      writeFileSync(directory + '/performance.json', JSON.stringify({ scope: 'local desktop Chromium lab observation',
        fieldPercentiles: false, representativeInp: false, ...performance }, null, 2))
      await page.goto('/sites/' + claimedProjectId + '?flag=' + panel.flag.id)
      await page.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const secondDialog = page.getByRole('dialog', { name: SITE_BOARD_COPY.verifyFix, exact: true })
      await secondDialog.getByRole('textbox', { name: SITE_BOARD_COPY.changeLabel }).fill('Restore the existing action name after recurrence')
      repaired = true
      const secondResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/verify') && response.request().method() === 'POST')
      await secondDialog.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const secondAccepted = await secondResponse
      expect(secondAccepted.ok()).toBe(true)
      const secondVerification = await secondAccepted.json()
      await complete(secondVerification.verificationAuditId)
      await browserExpect(page.getByText(SITE_DASHBOARD_COPY.flagResolved, { exact: true })).toBeVisible({ timeout: 15_000 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: secondVerification.attemptId } }))
        .toMatchObject({ outcome: 'IMPROVED', comparable: true })
      await page.screenshot({ path: directory + '/flag-recovered-again.png', fullPage: true })
      if (authProof) {
        const cdp = await context.newCDPSession(page)
        await cdp.send('WebAuthn.enable')
        await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
          protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
          hasUserVerification: true, isUserVerified: true,
        } })
        await page.goto('/settings')
        const enable = page.getByRole('button', { name: AUTH.security.enableCta, exact: true })
        await browserExpect(enable).toBeDisabled()
        const unregistered = await context.request.post(webOrigin + '/api/auth/two-factor/enable', {
          headers: { origin: webOrigin }, data: { password, method: 'totp' },
        })
        expect(unregistered.status()).toBe(400)
        expect((await prisma.user.findUniqueOrThrow({ where: { id: browserUserId } })).twoFactorEnabled).toBe(false)
        const registration = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/passkey/verify-registration'))
        await page.getByRole('button', { name: AUTH.security.addPasskey, exact: true }).click()
        expect((await registration).ok()).toBe(true)
        await browserExpect(enable).toBeEnabled()
        await page.locator('#two-factor-password').fill(password)
        const enrollment = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/two-factor/enable'))
        await enable.click()
        const enrolled = await enrollment
        expect(enrolled.ok()).toBe(true)
        const recovery = await enrolled.json()
        expect(recovery.method).toBe('totp')
        expect(recovery.backupCodes.length).toBeGreaterThan(0)
        await browserExpect(page.locator('pre')).toBeVisible()
        await browserExpect(page.locator('pre')).toHaveText(recovery.backupCodes.join('\n'))
        for (const path of ['/two-factor/get-totp-uri', '/two-factor/verify-totp']) {
          const refused = await context.request.post(webOrigin + '/api/auth' + path, {
            headers: { origin: webOrigin }, data: { password, code: '000000' },
          })
          expect(refused.status()).toBe(404)
        }
        async function challenge(loginPage: Page) {
          await loginPage.goto('/sign-in')
          const consent = loginPage.getByRole('button', { name: 'Only necessary', exact: true })
          if (await consent.isVisible()) await consent.click()
          await loginPage.getByLabel('Email', { exact: true }).fill(browserUserId + '@example.test')
          await loginPage.getByLabel('Password', { exact: true }).fill(password)
          await loginPage.getByRole('button', { name: 'Sign in', exact: true }).click()
          await loginPage.waitForURL(location => location.pathname === '/two-factor')
        }
        expect((await context.request.post(webOrigin + '/api/auth/sign-out', { headers: { origin: webOrigin }, data: {} })).ok()).toBe(true)
        await challenge(page)
        await page.getByRole('button', { name: 'Continue with passkey', exact: true }).click()
        await page.waitForURL(location => !location.pathname.startsWith('/two-factor'))
        expect((await (await context.request.get(webOrigin + '/api/auth/get-session')).json()).user.twoFactorEnabled).toBe(true)
        // A successfully used passkey can trust its device. Recovery and replay
        // use fresh browser contexts so neither can borrow that remembered grant.
        for (const replaying of [false, true]) {
          const recoveryContext = await browser.newContext({ baseURL: webOrigin })
          await recoveryContext.route('**/*', route => {
            const target = new URL(route.request().url())
            return ['http:', 'https:'].includes(target.protocol) && !['localhost', '127.0.0.1'].includes(target.hostname)
              ? route.abort('blockedbyclient') : route.continue()
          })
          const recoveryPage = await recoveryContext.newPage()
          try {
            await challenge(recoveryPage)
            if (replaying) {
              const replay = await recoveryContext.request.post(webOrigin + '/api/auth/two-factor/verify-backup-code', {
                headers: { origin: webOrigin }, data: { code: recovery.backupCodes[0] },
              })
              expect(replay.ok()).toBe(false)
              expect((await replay.json()).code).toBe('INVALID_BACKUP_CODE')
              expect(await (await recoveryContext.request.get(webOrigin + '/api/auth/get-session')).json()).toBeNull()
            } else {
              await recoveryPage.getByLabel('Backup code', { exact: true }).fill(recovery.backupCodes[0])
              await recoveryPage.getByRole('button', { name: 'Verify backup code', exact: true }).click()
              await recoveryPage.waitForURL(location => !location.pathname.startsWith('/two-factor'))
              expect((await (await recoveryContext.request.get(webOrigin + '/api/auth/get-session')).json()).user.twoFactorEnabled).toBe(true)
            }
          } finally { await recoveryContext.close() }
        }
      }
      writeFileSync(directory + '/observations.json', JSON.stringify({ scope: 'local API-admitted Site, browser claim, compiled category repair and recurrence',
        ordinaryUrlEntry: false, loopbackRefusedByUi: true, admission: 'normal API with existing explicit local-fixture option',
        ordinaryBrowserSignIn: true, sameEvidenceClaimed: true, defaultMonitoring: true, outcomeCompletionObservedInBrowser: true,
        fixtureAccount: 'ordinary verified account seeded in disposable database, not email delivery proof',
        nativeClipboardReadback: true, independentWorkerRecovery: true,
        durableRecurrenceIdentity: true, secondIndependentRecovery: true,
        legacyPasswordSignIn: true, passkeyAndBackupRecovery: authProof, publicTotpRefused: authProof, backupReplayRefused: authProof,
        sourceAuditId: initialAuditId, recurrenceAuditId: recurring.auditId,
        verificationAuditIds: [verification.verificationAuditId, secondVerification.verificationAuditId],
        runtimeErrors, accessibility, fullWcagAaCompliance: false,
        realProvidersUsed: false, providerTransport: 'explicit local refusal', productionChanged: false, candidateFrozen: false }, null, 2))
    } finally {
      await page.screenshot({ path: directory + '/last-state.png', fullPage: true }).catch(() => {})
      await context.tracing.stop({ path: directory + '/trace.zip' })
      await browser.close()
    }
  }, 360_000)
})
