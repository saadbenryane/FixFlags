import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { authorizeOutcomeFixture, listOutcomeFixtures } from '@/lib/sites/application/outcome-fixtures'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { getAuditBrowser, closeBrowser } from '@/lib/audit/screenshot'
import { encryptSecret } from '@/lib/security/crypto'
import { reconcileTasks, dispatchReadyTasks } from '../engine'
import { searchArtifactSchema } from '../evaluators'
import { readArtifact } from '../contracts'
import { executionWrite, withExecutionOwnership, ExecutionOwnershipLost } from '@/lib/audit/execution-ownership'
import { SEARCH_LOCAL_MODULES } from '@/lib/audit/search/workflow'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { applyJourneyRouteGuards } from '@/lib/audit/browser/journey-safety'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { checkVerifierSchema } from '@/lib/audit/checks/verification'
import { classifyTrackingEndpoint } from '@/lib/audit/tracking/endpoints'
import { projectCheckResults } from '@/lib/sites/check-results'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { productTransaction } from '@/lib/billing/product-transaction'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadMonitoringHistory } from '@/lib/sites/application/monitoring-history'
import { notifyWatchRegression } from '@/lib/audit/project-watch'
import { fetchPageSpeedData } from '@/lib/audit/pagespeed'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { persistDeterministicFlags } from '@/lib/audit/persist'
import { materializeAttentionForAudit } from '@/lib/improvements/service'
import { hasRecordedRecoveryEvidence } from '@/lib/audit/recovery-evidence'
import { probeFormValidation } from '@/lib/audit/flow/form-probes'
import { checkFormValidation } from '@/lib/audit/checks/form-validation'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('migrated progressive execution', () => {
  const suffix = randomUUID()
  const userId = 'execution-user-' + suffix
  const projectId = 'execution-project-' + suffix
  const origin = 'https://example.com'
  const destinationOrigin = 'https://example.net'
  let releaseResources!: () => void
  const resources = new Promise<void>(resolve => { releaseResources = resolve })
  const requests: string[] = []
  let focusRepaired = false
  let restorationRepaired = false
  let trackingRepaired = false
  let destinationsRepaired = false
  let availabilityChallenged = false
  let availabilityStatus = 200
  let otherAvailabilityStatus = 200
  let signupMode: 'success' | 'missing' | 'preexisting' = 'success'
  let signupCleanupOk = true
  let signupSubmissions = 0
  let pageSpeedMode: 'failed' | 'missing' | 'healthy' | null = null
  let publicFormMode: 'broken' | 'blocked' | 'socket' | 'hidden' | 'unrelated' | 'outside' | 'slow' | 'healthy' | 'native' | 'prefilled' = 'broken'
  let publicFormSubmissions = 0
  const server = createServer(async (req, res) => {
    requests.push(req.url!)
    if (req.url === '/sitemap.xml' || req.url === '/canonical') await resources
    if (res.destroyed) return
    if (req.url === '/public-form-submission') {
      publicFormSubmissions++
      res.end('This endpoint must not receive a public validation probe.')
    } else if (req.url === '/public-form') {
      const mode = publicFormMode
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Public form fixture</title></head><body><main><h1>Public form fixture</h1>' +
        (mode === 'unrelated' || mode === 'hidden' ? '<form id="other"><label>Other email<input name="other" required></label><button>Other form</button></form>' : '') +
        '<form id="primary"' + (mode === 'hidden' ? ' hidden' : '') + '><label>Email<input name="email" aria-required="true"' +
        (mode === 'native' ? ' required' : '') + (mode === 'prefilled' ? ' value="PRIVATE_FORM_VALUE@example.test"' : '') +
        '></label><button type="submit">Subscribe</button><p role="alert" id="error" hidden></p></form>' +
        '<script>const form=document.getElementById("primary"),mode=' + JSON.stringify(mode) + ';window.validationCalls=0;' +
        'form.onsubmit=e=>{if(e.defaultPrevented)return;window.validationCalls++;e.preventDefault();' +
        'if(mode==="blocked")fetch("/public-form-submission",{method:"POST",body:"unauthorized"}).catch(()=>{});' +
        'if(mode==="socket")new WebSocket("wss://example.com/public-form-submission");' +
        'if(mode==="outside")setTimeout(()=>{const p=document.createElement("p");p.setAttribute("role","alert");p.textContent="Error outside the form";document.body.append(p)},100);' +
        'if(mode==="slow"||mode==="healthy")setTimeout(()=>{const p=document.getElementById("error");p.hidden=false;p.textContent="Email is required"},mode==="slow"?1400:100)};</script>' +
        '</main></body></html>')
    } else if (req.url?.startsWith('/pagespeed-fixture')) {
      const failed = pageSpeedMode === 'failed'
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ lighthouseResult: { categories: { performance: { score: failed ? 0.35 : 0.95 } }, audits: {
        'largest-contentful-paint': { numericValue: 1000 }, 'cumulative-layout-shift': { numericValue: 0 },
        'first-contentful-paint': { numericValue: 500 }, 'total-blocking-time': { numericValue: 0 },
        ...(pageSpeedMode === 'missing' ? {} : {
          'render-blocking-insight': { score: failed ? 0 : 1, metricSavings: { FCP: failed ? 900 : 0 } },
          'unused-javascript': { score: failed ? 0 : 1, details: { overallSavingsBytes: failed ? 200_000 : 0 } },
          'unused-css-rules': { score: failed ? 0 : 1, details: { overallSavingsBytes: failed ? 80_000 : 0 } },
          'image-delivery-insight': { score: failed ? 0 : 1, details: { debugData: { wastedBytes: failed ? 150_000 : 0 } } },
        }),
      } } }))
    } else if (req.url === '/robots.txt') {
      res.setHeader('content-type', 'text/plain')
      res.end('User-agent: *\nDisallow: /private\nSitemap: ' + origin + '/sitemap.xml')
    } else if (req.url === '/sitemap.xml') {
      res.setHeader('content-type', 'application/xml')
      res.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + '/</loc></url></urlset>')
    } else if (req.url === '/signup-reset' || req.url === '/signup-cleanup') {
      let body = ''
      for await (const chunk of req) body += chunk
      const operationId = (JSON.parse(body) as { operationId?: string }).operationId
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: req.url === '/signup-reset' || signupCleanupOk, operationId, settled: signupCleanupOk }))
    } else if (req.url === '/signup-submit') {
      expect(req.method).toBe('POST')
      signupSubmissions++
      for await (const chunk of req) void chunk
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: signupMode === 'success' }))
    } else if (req.url === '/signup-flow') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Signup fixture</title></head><body><main><h1>Signup fixture</h1>' +
        '<form><label>Email<input name="email" type="email"></label><button>Sign up</button></form>' +
        '<p id="completion"' + (signupMode === 'preexisting' ? '' : ' hidden') + '>Check your inbox</p>' +
        '<script>document.querySelector("form").onsubmit=async e=>{e.preventDefault();const r=await fetch("/signup-submit",' +
        '{method:"POST",body:new FormData(e.target)});const result=await r.json();if(result.ok)setTimeout(()=>{document.getElementById("completion").hidden=false},250)}</script>' +
        '</main></body></html>')
    } else if (req.url === '/cleanup') {
      let body = ''
      for await (const chunk of req) body += chunk
      const operationId = (JSON.parse(body) as { operationId: string }).operationId
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true, operationId, settled: false }))
    } else if (req.url === '/canonical') {
      res.writeHead(404); res.end('Missing canonical destination')
    } else if (req.url?.startsWith('/_vercel/insights/script.js')) {
      res.setHeader('content-type', 'application/javascript')
      res.writeHead(trackingRepaired ? 200 : 503)
      res.end(trackingRepaired ? 'navigator.sendBeacon("/_vercel/insights/view", "PRIVATE_TRACKING_PAYLOAD")' : 'Library unavailable')
    } else if (['/checkout-destination', '/login-destination', '/preview.png'].includes(req.url ?? '')) {
      res.setHeader('content-type', req.url === '/preview.png' ? 'image/png' : 'text/html')
      res.writeHead(req.method === 'HEAD' || destinationsRepaired ? 200 : 404)
      res.end(destinationsRepaired && req.url === '/preview.png'
        ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTwsAAAAASUVORK5CYII=', 'base64')
        : destinationsRepaired ? 'Available destination' : 'Missing destination')
    } else if (req.url === '/destinations') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Destination fixture</title><meta property="og:image" content="/preview.png"></head>' +
        '<body><main><h1>Destination fixture</h1><a href="' + destinationOrigin + '/checkout-destination">Subscribe</a><a href="' + destinationOrigin + '/login-destination">Log in</a></main></body></html>')
    } else if (req.url === '/tracking') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Tracking fixture</title><script src="/_vercel/insights/script.js"></script></head>' +
        '<body><main><h1>Tracking fixture</h1><a href="#details" onclick="const s=document.createElement(\'script\');s.src=\'/_vercel/insights/script.js?phase=action\';document.head.append(s)">Get started</a><section id="details">Useful details</section></main></body></html>')
    } else if (req.url === '/keyboard') {
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><html lang="en"><head><title>Keyboard fixture</title><style>#first:focus-visible,#second:focus-visible {' +
        (focusRepaired ? 'outline:3px solid blue;outline-offset:2px' : 'outline:none;box-shadow:none') +
        '}</style></head><body><main><h1>Keyboard fixture</h1><button id="first">First</button><button id="second">Second</button>' +
        '<button id="options" aria-haspopup="menu" aria-controls="menu">Options</button><div role="menu" id="menu" hidden>' +
        '<button role="menuitem" tabindex="-1" id="item-one">One</button><button role="menuitem" tabindex="-1" id="item-two">Two</button></div>' +
        '<script>const t=document.getElementById("options"),m=document.getElementById("menu"),items=[...m.querySelectorAll("button")];' +
        't.onclick=()=>{m.hidden=false;items[0].focus()};m.onkeydown=e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp")' +
        '{e.preventDefault();items[(items.indexOf(document.activeElement)+1)%2].focus()};if(e.key==="Escape"){m.hidden=true;' +
        (restorationRepaired ? 't.focus()' : 'document.activeElement.blur()') + '}}</script></main></body></html>')
    } else {
      res.setHeader('content-type', 'text/html')
      if (req.url === '/') res.statusCode = availabilityStatus
      if (req.url === '/independent-page') res.statusCode = otherAvailabilityStatus
      if (availabilityChallenged && req.url === '/') res.setHeader('cf-mitigated', 'challenge')
      res.end('<!doctype html><html lang="en"><head><title>Execution fixture</title><link rel="canonical" href="/canonical"></head><body><main><h1>Execution fixture</h1></main><footer>Cloudflare and CAPTCHA resources</footer></body></html>')
    }
  })
  let worker: ReturnType<typeof startWorker> | undefined

  function fixtureTransport() {
    const originalSession = pageSessions.createAuditPage
    return vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => originalSession(browser, url, {
      ...options, configurePage: async page => {
        // Serve controlled HTML through real Chromium. Retain the production
        // mutation guard rather than granting the fixture implicit submission consent.
        await page.route(origin + '/**', async route => {
          if (classifyTrackingEndpoint(route.request().url(), route.request().resourceType(), origin)?.role === 'event') return route.fallback()
          const fulfill = async () => {
            const request = route.request()
            const response = await fetch(request.url(), { method: request.method(), body: request.postDataBuffer() ?? undefined,
              headers: request.method() === 'POST' ? { 'content-type': request.headers()['content-type'] ?? 'application/json' } : undefined })
            await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers.entries()), body: await response.text() })
          }
          if (options.journeySafe || options.buyPath) await applyJourneyRouteGuards(route, fulfill)
          else await fulfill()
        })
        // The fixture's own authorization and request guard runs before transport.
        await options.configurePage?.(page)
      },
    }))
  }

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use scripts/verify-progressive-execution.mjs to create disposable execution resources')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    const nativeFetch = globalThis.fetch
    // Only transport is replaced. Public URL validation, HTTP/body collection,
    // task ownership, queues, evaluator threads and database projections are real.
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.hostname === 'www.googleapis.com' && url.pathname === '/pagespeedonline/v5/runPagespeed' && pageSpeedMode)
        return nativeFetch(`http://127.0.0.1:${address.port}/pagespeed-fixture?strategy=${url.searchParams.get('strategy')}`, init)
      if (![origin, destinationOrigin].includes(url.origin)) throw new Error('External service unavailable in this fixture')
      return nativeFetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`, init)
    })
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Execution fixture', url: origin + '/', canonicalHost: 'example.com' } })
    await getAuditTaskQueue('browser').pause()
    await getAuditTaskQueue('provider').pause()
    await getAuditBrowser()
    worker = startWorker()
    await worker.waitUntilReady()
  })

  afterAll(async () => {
    releaseResources()
    await worker?.close()
    await clearWorkerHeartbeat()
    await closeBrowser()
    for (const queue of [getAuditQueue(), ...(['http', 'browser', 'provider', 'evaluate', 'availability'] as const).map(getAuditTaskQueue)]) {
      const client = await queue.client
      await queue.close()
      client.disconnect()
    }
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    vi.unstubAllGlobals()
    await prisma.$disconnect()
  })

  it('reads the execution ledger from the fully migrated disposable database', async () => {
    const url = new URL(process.env.DATABASE_URL!)
    expect(['localhost', '127.0.0.1']).toContain(url.hostname)
    expect(url.pathname).toMatch(/^\/fixflags_execution_test_[a-f0-9]{32}$/)
    expect(await prisma.auditVerifierExecution.count()).toBe(0)
    expect(await prisma.auditPipelineEvent.count()).toBe(0)
  })

  it('publishes independent Search results before slow resources and finalizes honest partial coverage', async () => {
    const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'progressive-search' })
    const replay = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'progressive-search' })
    expect(replay).toMatchObject({ runId: admitted.runId, auditId: admitted.auditId, reused: true })
    const auditId = admitted.auditId!
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, targetKey: 'task:p0:search-crawl' } })).toMatchObject({ workState: 'COMPLETED' })
    }, { timeout: 15_000, interval: 100 })
    expect(requests).toContain('/robots.txt')
    expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ dispatchState: 'SENT', status: 'CHECKING' })
    expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, targetKey: 'task:resources' } })).toMatchObject({ workState: 'RUNNING' })
    expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, targetKey: 'task:p0:search' } })).toMatchObject({ workState: 'WAITING' })
    // Model terminally unavailable dependencies while retaining the actual
    // collector and evaluator results. No successful browser input is invented.
    await prisma.auditVerifierExecution.updateMany({ where: { auditId, workKind: { in: ['browser', 'keyboard', 'captures', 'pagespeed', 'google'] } },
      data: { workRecoveryUntil: new Date(0) } })
    await dispatchReadyTasks(await reconcileTasks(auditId))
    await getAuditTaskQueue('browser').resume()
    await getAuditTaskQueue('provider').resume()
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, targetKey: 'task:p0:search-presentation' } })).toMatchObject({ workState: 'COMPLETED' })
      expect(await prisma.flag.count({ where: { auditId } })).toBeGreaterThan(0)
    }, { timeout: 15_000, interval: 100 })
    const early = await loadSiteHome(projectId)
    expect(early).not.toBeNull()
    releaseResources()
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
    }, { timeout: 15_000, interval: 100 }).catch(async error => {
      console.log(await prisma.auditVerifierExecution.findMany({ where: { auditId, workKind: { not: null }, workState: { not: 'COMPLETED' } },
        select: { targetKey: true, workState: true, workErrorCode: true } }))
      throw error
    })
    expect(await prisma.runRequest.findUnique({ where: { id: admitted.runId } })).toMatchObject({ status: 'COMPLETED' })
    expect(await prisma.audit.findUnique({ where: { id: auditId } })).toMatchObject({ status: 'COMPLETED', reportCompleteness: 'PARTIAL' })
    const summary = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, targetKey: 'task:p0:search' } })
    const receipt = searchArtifactSchema.parse(readArtifact(summary.workResult, 'search').data).receipt
    expect(receipt.complete).toBe(false)
    expect(receipt.observations.some(item => item.disposition === 'unknown')).toBe(true)
    expect(await prisma.auditVerifierExecution.count({ where: { auditId, targetKey: { in: SEARCH_LOCAL_MODULES } } })).toBe(6)
    expect(await prisma.auditPipelineEvent.count({ where: { auditId, event: 'task_observation_committed' } })).toBeGreaterThan(6)
  })

  it('fences an interrupted Signup owner and refuses replay until exact-operation cleanup is settled', async () => {
    await getAuditTaskQueue('browser').pause()
    const fixture = await prisma.outcomeFixture.create({ data: { projectId, name: 'Signup fixture', targetUrl: origin + '/signup',
      fieldMapping: { fields: { email: { by: 'label', value: 'Email' } }, submit: { by: 'role', role: 'button', value: 'Sign up' } },
      encryptedValues: encryptSecret(JSON.stringify({ email: 'synthetic@example.test' })),
      successCriterion: { type: 'text', value: 'Check your inbox' }, resetUrl: origin + '/reset', cleanupUrl: origin + '/cleanup',
      authorizedAt: new Date(), lastDryRunVersion: 1, lastDryRunResult: { disposition: 'SUCCEEDED', reason: 'previous', detail: { fieldCount: 1, cleanupStatus: 'succeeded' } } } })
    const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'FIXTURE_SETUP', fixtureId: fixture.id, idempotencyKey: 'signup-setup' })
    const auditId = admitted.auditId!
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'fixture-setup' } })).not.toBeNull()
    }, { timeout: 10_000, interval: 100 })
    expect(await prisma.outcomeFixture.findUnique({ where: { id: fixture.id } })).toMatchObject({ authorizedAt: null, lastDryRunVersion: null })
    const task = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, workKind: 'fixture-setup' } })
    const owner = { auditId, taskId: task.id, token: 'interrupted-owner', generation: 1 }
    const operationId = task.id + ':g1'
    await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workState: 'RUNNING', status: 'RUNNING',
      workToken: owner.token, workGeneration: 1, workAttempts: 1, workLeaseUntil: new Date(Date.now() + 90_000) } })
    await withExecutionOwnership(owner, async () => {
      await executionWrite(tx => tx.auditPipelineEvent.create({ data: { auditId, executionId: operationId, traceId: auditId,
        attempt: 1, stage: 'checking', status: 'started', event: 'protected_submission_admitted',
        detail: { operationId, fixtureId: fixture.id, fixtureVersion: fixture.version } } }))
    })
    await expect(withExecutionOwnership(owner, () => executionWrite(tx => tx.outcomeFixture.update({ where: { id: fixture.id },
      data: { authorizedAt: new Date() } })))).rejects.toBeInstanceOf(ExecutionOwnershipLost)
    await reconcileTasks(auditId)
    expect(await prisma.auditVerifierExecution.findUnique({ where: { id: task.id } })).toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'WORKER_INTERRUPTED' })
    await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
    await dispatchReadyTasks(await reconcileTasks(auditId))
    await getAuditTaskQueue('browser').resume()
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findUnique({ where: { id: task.id } })).toMatchObject({ workState: 'BLOCKED',
        workGeneration: 2, workErrorCode: 'PROTECTED_EFFECT_UNRESOLVED' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
    }, { timeout: 15_000, interval: 100 })
    expect(requests).toContain('/cleanup')
    expect(requests).not.toContain('/reset')
    expect(requests).not.toContain('/signup')
    expect(await prisma.runRequest.findUnique({ where: { id: admitted.runId } })).toMatchObject({ status: 'FAILED' })
    expect((await listOutcomeFixtures(projectId))[0]).toMatchObject({ authorizedAt: null, lastDryRunResult: { disposition: 'BLOCKED', detail: { cleanupStatus: 'unknown' } } })
    await expect(authorizeOutcomeFixture(projectId, fixture.id)).rejects.toMatchObject({ code: 'FIXTURE_DRY_RUN_REQUIRED' })
    const site = await loadSiteHome(projectId)
    expect(site).not.toBeNull()
    expect(site!.audit.id).not.toBe(auditId)
  })

  it('collects a real keyboard failure and verifies the repaired controls through targeted application admission', async () => {
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').pause()
      await getAuditTaskQueue('provider').pause()
      const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE',
        url: origin + '/keyboard', idempotencyKey: 'keyboard-source' })
      const beforeId = admitted.auditId!
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'keyboard' } })).not.toBeNull()
      }, { timeout: 10_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: beforeId,
        workKind: { in: ['browser', 'captures', 'pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(beforeId))
      await getAuditTaskQueue('browser').resume()
      await getAuditTaskQueue('provider').resume()
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId: 'focus-visible-missing' } })
      expect(flag).toMatchObject({ source: 'DETERMINISTIC', pageUrl: origin + '/keyboard',
        evidenceTargets: [{ selector: '#first', source: 'measured' }, { selector: '#second', source: 'measured' }] })
      expect(flag.fix).toContain(':focus-visible')
      const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'keyboard-fix',
        changeSummary: 'Restore the focus outline on the two reported controls' })
      focusRepaired = true
      const verified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'keyboard-verification',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: beforeId } })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: verified.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, workKind: { not: null } } })
      expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'keyboard'])
      const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'check:focus-visible-missing' } })
      expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'keyboard',
        assertion: { targets: [{ selector: '#first', label: 'First' }, { selector: '#second', label: 'Second' }] } })
      expect(await prisma.improvementAttempt.findUnique({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true,
        improvementId: expect.any(String) })
      const receipt = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'module:keyboard' } })
      const observed = projectCheckResults(verified.auditId!, [receipt])
      expect(observed.filter(result => result.name === 'Focus indicators on exercised controls').every(result => result.status === 'passed')).toBe(true)
      expect(observed.find(result => result.name === 'Options: Focus after dismissal')?.status).toBe('findings')
      expect(observed.find(result => result.kind === 'execution')?.status).toBe('unknown')

      const popupFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId: 'keyboard-focus-restoration' } })
      expect(popupFlag.evidenceTargets).toMatchObject([{ selector: '#options', context: 'menu:#options=>#menu' }])
      const popupFix = await recordSiteFlagFix({ siteId: projectId, flagId: popupFlag.id, userId,
        idempotencyKey: 'popup-fix', changeSummary: 'Restore focus to Options after dismissing the menu' })
      restorationRepaired = true
      const popupVerified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'popup-verification',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: popupFlag.pageUrl!, checkId: popupFlag.checkId!, attemptId: popupFix.attemptId, parentAuditId: beforeId } })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: popupVerified.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      const popupTasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: popupVerified.auditId!, workKind: { not: null } } })
      expect(popupTasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'keyboard'])
      const popupProof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: popupVerified.auditId!, targetKey: 'check:keyboard-focus-restoration' } })
      expect(checkVerifierSchema.parse(popupProof.detail)).toMatchObject({ verdict: 'passed', source: 'keyboard',
        assertion: { targets: [{ selector: '#options', label: 'Options', context: 'menu:#options=>#menu' }] } })
      expect(await prisma.improvementAttempt.findUnique({ where: { id: popupFix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    } finally { transport.mockRestore() }
  })
  it('observes Tracking library failures in loading and the public walk, then verifies both repaired scopes without delivering events', async () => {
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').pause(); await getAuditTaskQueue('provider').pause()
      const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', url: origin + '/tracking', idempotencyKey: 'tracking-source' })
      const beforeId = admitted.auditId!
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'browser' } })).not.toBeNull()
      }, { timeout: 10_000, interval: 100 })
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: beforeId,
        workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(beforeId))
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 30_000, interval: 100 })
      const walk = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: beforeId, workKind: 'flow' } })
      expect(walk).toMatchObject({ workState: 'COMPLETED' })
      expect((readArtifact(walk.workResult, 'flow').data as { tracking: { requests: unknown[] } }).tracking.requests).toMatchObject([{ role: 'library', status: 503 }])
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId: 'tracking-library-http-error' } })
      const targets = flag.evidenceTargets as Array<{ context: string }>
      expect(targets.some(target => target.context.startsWith('tracking:page_load:'))).toBe(true)
      expect(targets.some(target => target.context.startsWith('tracking:public_action:'))).toBe(true)
      const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'tracking-fix', changeSummary: 'Restore the requested tracking library endpoint' })
      trackingRepaired = true
      const verified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'tracking-verification',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: beforeId } })
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: verified.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 30_000, interval: 100 })
      const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, workKind: { not: null } } })
      expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'check', 'finalize', 'flow'])
      const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'check:tracking-library-http-error' } })
      expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'browser-network' })
      expect((proof.evidenceReference as { supportingTasks: unknown[] }).supportingTasks).toHaveLength(2)
      expect(await prisma.improvementAttempt.findUnique({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      const receipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, targetKey: 'module:measurement' } })
      const results = projectCheckResults(verified.auditId!, receipts)
      expect(results.some(result => result.assertionKey === 'tracking-initiation' && result.status === 'observed')).toBe(true)
      expect(results.filter(result => result.assertionKey === 'tracking-http-response' || result.assertionKey === 'tracking-provider-recording').every(result => result.status === 'unknown')).toBe(true)
      expect(JSON.stringify(receipts)).not.toContain('PRIVATE_TRACKING_PAYLOAD')
      expect(requests.some(path => path.startsWith('/_vercel/insights/view'))).toBe(false)
      const site = await loadSiteHome(projectId)
      expect(site!.cards.find(card => card.id === 'tracking')?.state).not.toBe('healthy')
    } finally { transport.mockRestore() }
  })

  it('verifies checkout, sign-in and preview-image repairs through the real application, queue and worker', async () => {
    const transport = fixtureTransport()
    try {
      await getAuditTaskQueue('browser').pause(); await getAuditTaskQueue('provider').pause()
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', url: origin + '/destinations', idempotencyKey: 'destination-source' })
      const beforeId = source.auditId!
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'browser' } })).not.toBeNull()
      }, { timeout: 10_000, interval: 100 })
      // These unrelated responsibilities are deliberately unavailable in this fixture.
      // The actual browser collector, destination evaluators and publication still run.
      await prisma.auditVerifierExecution.updateMany({ where: { auditId: beforeId,
        workKind: { in: ['keyboard', 'captures', 'pagespeed', 'google', 'flow', 'slow-replay', 'journeys'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(beforeId))
      await getAuditTaskQueue('browser').resume(); await getAuditTaskQueue('provider').resume()
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: beforeId, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 }).catch(async error => {
        console.log(await prisma.auditVerifierExecution.findMany({ where: { auditId: beforeId, workKind: { not: null }, workState: { not: 'COMPLETED' } },
          select: { targetKey: true, workState: true, workErrorCode: true } }))
        throw error
      })
      destinationsRepaired = true
      for (const checkId of ['checkout-link-dead', 'auth-page-broken', 'og-image-broken']) {
        const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: beforeId, checkId } })
        expect(flag.evidenceTargets).toMatchObject([{ kind: 'page', context: expect.stringMatching(/^destination:/) }])
        const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: checkId + '-fix',
          changeSummary: 'Restore the original public destination' })
        const verified = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: checkId + '-verification',
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: beforeId } })
        await vi.waitFor(async () => {
          expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: verified.auditId!, workKind: 'finalize' } })).toMatchObject({ workState: 'COMPLETED' })
        }, { timeout: 15_000, interval: 100 })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verified.auditId!, workKind: { not: null } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'check', 'finalize'])
        const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: verified.auditId!, targetKey: 'check:' + checkId } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'http', assertion: { complete: true } })
        expect(await prisma.improvementAttempt.findUnique({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
        expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verified.auditId })
      }
    } finally { transport.mockRestore() }
  }, 60_000)

  it('observes delayed signup completion and preserves actionable failure, uncertainty, repair and recurrence', async () => {
    const transport = fixtureTransport()
    try {
      const fixture = await prisma.outcomeFixture.create({ data: { projectId, name: 'Reversible signup', targetUrl: origin + '/signup-flow',
        fieldMapping: { fields: { email: { by: 'label', value: 'Email' } }, submit: { by: 'role', role: 'button', value: 'Sign up' } },
        encryptedValues: encryptSecret(JSON.stringify({ email: 'synthetic@example.test' })),
        successCriterion: { type: 'text', value: 'Check your inbox' }, resetUrl: origin + '/signup-reset', cleanupUrl: origin + '/signup-cleanup' } })
      const setup = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'FIXTURE_SETUP', fixtureId: fixture.id,
        idempotencyKey: 'signup-functional-setup' })
      await vi.waitFor(async () => {
        expect(await prisma.runRequest.findUnique({ where: { id: setup.runId } })).toMatchObject({ status: 'COMPLETED' })
      }, { timeout: 15_000, interval: 100 })
      expect(await prisma.outcomeFixture.findUnique({ where: { id: fixture.id } })).toMatchObject({
        lastDryRunVersion: 1, lastDryRunResult: { disposition: 'SUCCEEDED', detail: { cleanupStatus: 'succeeded' } } })
      await authorizeOutcomeFixture(projectId, fixture.id)
      const outcome = await prisma.siteOutcome.create({ data: { projectId, slug: 'signup-functional', name: 'Signup completes', kind: 'SIGNUP',
        bindings: { create: { key: 'signup-v1', mechanism: 'SAFE_FORM', required: true,
          config: { startUrl: origin + '/signup-flow', safety: 'reversible', authorized: true, fixtureId: fixture.id } } } } })
      const audits: string[] = []
      let attemptId = ''
      const phases = [
        { mode: 'missing', cleanup: true }, { mode: 'preexisting', cleanup: true },
        { mode: 'success', cleanup: false }, { mode: 'success', cleanup: true }, { mode: 'missing', cleanup: true },
      ] as const
      for (const [index, { mode, cleanup }] of phases.entries()) {
        signupMode = mode
        signupCleanupOk = cleanup
        const submissionsBefore = signupSubmissions
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'signup-functional:' + index })
        audits.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.runRequest.findUnique({ where: { id: run.runId } })).toMatchObject({ status: 'COMPLETED' })
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 20_000, interval: 100 })
        expect(signupSubmissions - submissionsBefore).toBe(mode === 'preexisting' ? 0 : 1)
        const execution = await prisma.outcomeBindingExecution.findFirstOrThrow({ where: { auditId: run.auditId!, outcomeId: outcome.id } })
        expect(execution.disposition).toBe(mode === 'missing' ? 'FAILED' : mode === 'success' && cleanup ? 'SUCCEEDED' : 'BLOCKED')
        expect(JSON.stringify(execution.detail)).not.toContain('synthetic@example.test')
        const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: { runRequestId: run.runId, outcomeId: outcome.id } } })
        expect(assessment.state).toBe(mode === 'missing' ? 'FLAG' : mode === 'success' && cleanup ? 'CLEAR' : 'COULD_NOT_VERIFY')
        if (!cleanup) expect(execution).toMatchObject({ reason: 'fixture_cleanup_unproven', detail: {
          cleanupStatus: 'failed', successObservation: { presentBeforeSubmit: false, presentAfterSubmit: true } } })
        const flags = await prisma.flag.findMany({ where: { auditId: run.auditId! } })
        expect(flags).toHaveLength(mode === 'missing' ? 1 : 0)
        if (mode === 'missing') {
          expect(execution.detail).toMatchObject({ failureFlagId: flags[0].id })
          expect(assessment.improvementId).toBeTruthy()
          expect(flags[0]).toMatchObject({ fingerprint: 'outcome:v1:' + outcome.id + ':signup-v1', checkId: 'outcome-signup-failed' })
          expect(flags[0].evidence).not.toContain('synthetic@example.test')
        }
        if (index === 0) attemptId = (await recordSiteFlagFix({ siteId: projectId, flagId: flags[0].id, userId,
          idempotencyKey: 'signup-functional-fix', changeSummary: 'Restore signup completion feedback' })).attemptId
        if (index === 1 || index === 2) expect(await prisma.flag.findFirst({ where: { auditId: audits[0] } })).toMatchObject({ status: 'OPEN' })
      }
      const failed = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[0] } })
      const recurred = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[4] } })
      expect(failed).toMatchObject({ status: 'FIXED', resolvedInId: audits[3] })
      expect(recurred.status).toBe('REGRESSED')
      const occurrences = await prisma.improvementOccurrence.findMany({ where: { flagId: { in: [failed.id, recurred.id] } } })
      expect(new Set(occurrences.map(item => item.improvementId)).size).toBe(1)
      expect(await prisma.improvementAttempt.findUnique({ where: { id: attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true,
        verificationAuditId: audits[3] })
      const verificationHistory = await prisma.improvementCycleEvent.findMany({ where: { attemptId, type: 'OUTCOME_ISSUED' },
        orderBy: { occurredAt: 'asc' }, select: { outcome: true, verificationAuditId: true } })
      expect(verificationHistory).toEqual([{ outcome: 'INCONCLUSIVE', verificationAuditId: audits[1] }, { outcome: 'IMPROVED', verificationAuditId: audits[3] }])
    } finally { signupMode = 'success'; signupCleanupOk = true; transport.mockRestore() }
  }, 60_000)

  it('runs default uptime independently of a customer session and retains real challenge uncertainty', async () => {
    const transport = fixtureTransport()
    try {
      expect(await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))).toBe(true)
      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      expect(project).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: expect.any(Date) })
      const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
      for (const challenged of [false, true]) {
        availabilityChallenged = challenged
        const admitted = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH',
          idempotencyKey: 'automatic-availability:' + challenged })
        await vi.waitFor(async () => {
          expect(await prisma.runRequest.findUnique({ where: { id: admitted.runId } })).toMatchObject({ status: 'COMPLETED' })
        }, { timeout: 15_000, interval: 100 })
        const observed = await prisma.outcomeBindingExecution.findFirstOrThrow({ where: { auditId: admitted.auditId!, outcomeId: outcome.id } })
        expect(observed).toMatchObject({ disposition: challenged ? 'BLOCKED' : 'SUCCEEDED', reason: challenged ? 'bot_wall' : 'available' })
        const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: { runRequestId: admitted.runId, outcomeId: outcome.id } } })
        expect(assessment.state).toBe(challenged ? 'COULD_NOT_VERIFY' : 'CLEAR')
        expect(await prisma.flag.count({ where: { auditId: admitted.auditId! } })).toBe(0)
      }
    } finally { availabilityChallenged = false; transport.mockRestore() }
  }, 30_000)

  it('preserves one uptime incident through a gap, proves recovery and recognizes recurrence', async () => {
    const transport = fixtureTransport()
    try {
      const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
      const audits: string[] = []
      let automaticAttemptId: string | undefined
      for (const [index, state] of [503, 'challenge', 503, 200, 503].entries()) {
        availabilityStatus = typeof state === 'number' ? state : 200
        availabilityChallenged = state === 'challenge'
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'uptime-cycle:' + index })
        audits.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.runRequest.findUnique({ where: { id: run.runId } })).toMatchObject({ status: 'COMPLETED' })
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        if (index === 2) {
          const sourceFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: run.auditId!, checkId: 'outcome-availability-failed' } })
          automaticAttemptId = (await recordSiteFlagFix({ siteId: projectId, flagId: sourceFlag.id, userId,
            idempotencyKey: 'uptime-ready-to-verify', changeSummary: 'Restore the public page response' })).attemptId
        }
      }
      const first = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[0], checkId: 'outcome-availability-failed' } })
      const continued = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[2], checkId: 'outcome-availability-failed' } })
      const recurred = await prisma.flag.findFirstOrThrow({ where: { auditId: audits[4], checkId: 'outcome-availability-failed' } })
      expect(first).toMatchObject({ status: 'FIXED', resolvedInId: audits[3] })
      expect(continued).toMatchObject({ status: 'FIXED', resolvedInId: audits[3] })
      expect(recurred).toMatchObject({ status: 'REGRESSED', resolvedInId: null })
      const occurrences = await prisma.improvementOccurrence.findMany({ where: { flagId: { in: [first.id, continued.id, recurred.id] } } })
      expect(new Set(occurrences.map(item => item.improvementId)).size).toBe(1)
      expect(await prisma.improvementAttempt.findUnique({ where: { id: automaticAttemptId! } })).toMatchObject({ outcome: 'IMPROVED', comparable: true, verificationAuditId: audits[3] })
      const counts = await prisma.audit.findMany({ where: { id: { in: audits } }, select: { id: true, watchRegressionCount: true, watchRecoveryCount: true } })
      expect(audits.map(id => counts.find(item => item.id === id))).toMatchObject([
        { watchRegressionCount: 1, watchRecoveryCount: 0 }, { watchRegressionCount: 0, watchRecoveryCount: 0 },
        { watchRegressionCount: 0, watchRecoveryCount: 0 }, { watchRegressionCount: 0, watchRecoveryCount: 1 },
        { watchRegressionCount: 1, watchRecoveryCount: 0 },
      ])
      const history = await loadMonitoringHistory((await loadSiteRecord(projectId))!)
      expect(history.timeline.find(item => item.id === audits[3])).toMatchObject({ result: 'CLEAR', completionState: 'COMPLETED' })
      expect(history.timeline.find(item => item.id === audits[1])).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
      const saved = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      const liveLease = new Date(Date.now() + 60_000)
      await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: liveLease } })
      await notifyWatchRegression(null, audits[0])
      expect(await prisma.project.findUnique({ where: { id: projectId } })).toMatchObject({ watchLastRunAt: saved.watchLastRunAt, watchLeaseUntil: liveLease })
      await prisma.project.update({ where: { id: projectId }, data: { watchLeaseUntil: null } })
    } finally { availabilityStatus = 200; availabilityChallenged = false; transport.mockRestore() }
  }, 60_000)

  it('keeps a proven historical uptime Improvement identity when migrating its single bound responsibility', async () => {
    const transport = fixtureTransport()
    try {
      const outcome = await prisma.siteOutcome.create({ data: { projectId, slug: 'legacy-uptime', name: 'Historical availability', kind: 'AVAILABILITY',
        confirmedAt: new Date(), bindings: { create: { key: 'legacy-http', mechanism: 'HTTP_AVAILABILITY', required: true,
          config: { startUrl: origin + '/', expectedSelector: 'body' } } } } })
      availabilityStatus = 503
      const before = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'legacy-source' })
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUnique({ where: { id: before.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 100 })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: before.auditId!, checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
      const improvementId = flag.improvementOccurrence!.improvementId
      const assessment = await prisma.outcomeAssessment.findFirstOrThrow({ where: { auditId: before.auditId!, outcomeId: outcome.id } })
      const historicalEvidence = { ...(assessment.evidence as Record<string, unknown>) }
      delete historicalEvidence.incident
      // Model the prior persisted contract while retaining its real execution,
      // version, scope and original IDs. No positive website result is invented.
      await prisma.outcomeAssessment.update({ where: { id: assessment.id }, data: { evidence: historicalEvidence as import('@prisma/client').Prisma.InputJsonValue } })
      await prisma.flag.update({ where: { id: flag.id }, data: { fingerprint: 'outcome:availability:legacy-http' } })
      await prisma.improvement.update({ where: { id: improvementId }, data: { fingerprint: 'check:outcome-availability-failed' } })
      const runs: string[] = []
      for (const [index, status] of [503, 200, 503].entries()) {
        availabilityStatus = status
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [outcome.id], source: 'WATCH', idempotencyKey: 'legacy-followup:' + index })
        runs.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
      }
      expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: runs[1] })
      const current = await prisma.flag.findFirstOrThrow({ where: { auditId: runs[2], checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
      expect(current).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId } })
      expect(await prisma.improvement.count({ where: { projectId, outcomeId: outcome.id } })).toBe(1)
    } finally { availabilityStatus = 200; transport.mockRestore() }
  }, 60_000)

  it('proves Public form validation, safe limits and comparable repairs through Chromium and the worker', async () => {
    const transport = fixtureTransport()
    await getAuditTaskQueue('browser').resume()
    try {
      const pageUrl = origin + '/public-form', token = randomUUID()
      const ordinary = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, deadline: Date.now() + 8000,
      })
      try {
        await ordinary.page.evaluate(() => document.querySelector('form')?.setAttribute('data-fixflags-local-validation', 'forged'))
        expect((await probeFormValidation(ordinary.page, { isolated: true })).evidence).toMatchObject({ disposition: 'unknown', reason: 'submit_handler_suppressed' })
        expect(await ordinary.page.evaluate(() => (window as unknown as { validationCalls: number }).validationCalls)).toBe(0)
      } finally { ordinary.disposeNetwork(); await ordinary.page.context().close() }
      const session = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, localFormValidationToken: token, deadline: Date.now() + 10_000,
      })
      let probe
      try {
        probe = await probeFormValidation(session.page, { isolated: true, localValidationToken: token, deadline: Date.now() + 4000 })
        expect(probe.evidence).toMatchObject({ disposition: 'failed', reason: 'missing_feedback' })
        expect(await session.page.evaluate(() => (window as unknown as { validationCalls: number }).validationCalls)).toBe(1)
      } finally { session.disposeNetwork(); await session.page.context().close() }
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date() } })
      await persistDeterministicFlags(source.id, checkFormValidation(probe.evidence).flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await materializeAttentionForAudit(source.id)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'flow-form-no-validation' } })
      let slowFlag: typeof flag | undefined
      for (const mode of ['blocked', 'socket', 'hidden', 'prefilled', 'outside', 'unrelated', 'slow', 'healthy'] as const) {
        publicFormMode = mode
        const target = mode === 'healthy' ? slowFlag! : flag
        const fixed = await recordSiteFlagFix({ siteId: projectId, flagId: target.id, userId,
          idempotencyKey: 'public-form-fix:' + mode, changeSummary: 'Restore local required-field feedback on the same form' })
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'DIAGNOSTIC',
          idempotencyKey: 'public-form-verify:' + mode, verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: target.checkId!,
            parentAuditId: target.auditId, attemptId: fixed.attemptId } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        const expected = mode === 'unrelated' ? 'UNCHANGED' : mode === 'slow' || mode === 'healthy' ? 'IMPROVED' : 'INCONCLUSIVE'
        expect(await prisma.improvementAttempt.findUnique({ where: { id: fixed.attemptId } })).toMatchObject({ outcome: expected,
          comparable: expected !== 'INCONCLUSIVE', verificationAuditId: run.auditId })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, targetKey: { startsWith: 'task:' } }, select: { workKind: true } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['finalize', 'flow'])
        const observed = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: run.auditId!, targetKey: 'module:form-validation' } })
        expect(JSON.stringify(observed.detail)).not.toContain('PRIVATE_FORM_VALUE')
        if (expected === 'INCONCLUSIVE') {
          expect(observed.detail).toMatchObject({ complete: false, passed: false })
          expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
          expect(await prisma.flag.count({ where: { auditId: run.auditId! } })).toBe(0)
        }
        if (mode === 'slow') slowFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: run.auditId!, checkId: 'flow-form-slow-feedback' } })
        if (mode === 'slow' || mode === 'healthy') expect(await prisma.flag.findUnique({ where: { id: target.id } })).toMatchObject({ status: 'FIXED', resolvedInId: run.auditId })
      }
      expect(publicFormSubmissions).toBe(0)
      expect(await prisma.flag.findUnique({ where: { id: slowFlag!.id } })).toMatchObject({ status: 'FIXED' })
      publicFormMode = 'healthy'
      const measured = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, localFormValidationToken: token, deadline: Date.now() + 8000,
      })
      try {
        const click = measured.page.$.bind(measured.page)
        vi.spyOn(measured.page, '$').mockImplementation(async selector => {
          const element = await click(selector)
          if (element) {
            const nativeClick = element.click.bind(element)
            vi.spyOn(element, 'click').mockImplementation(async options => {
              await nativeClick(options)
              await new Promise(resolve => setTimeout(resolve, 1200))
            })
          }
          return element
        })
        const delayedRead = await probeFormValidation(measured.page, { isolated: true, localValidationToken: token, deadline: Date.now() + 6000 })
        expect(delayedRead.evidence).toMatchObject({ disposition: 'passed', reason: 'client_feedback' })
        expect(delayedRead.feedbackMs!).toBeLessThan(1000)
        expect(checkFormValidation(delayedRead.evidence).flags).toEqual([])
      } finally { measured.disposeNetwork(); await measured.page.context().close() }
    } finally { publicFormMode = 'broken'; transport.mockRestore() }
  }, 45_000)

  it('verifies Performance score and resource repairs from fresh provider observations through the worker', async () => {
    await getAuditTaskQueue('provider').resume()
    try {
      const pageUrl = origin + '/performance-fixture'
      pageSpeedMode = 'failed'
      const measured = await fetchPageSpeedData(pageUrl, undefined, { fresh: true, singleAttempt: true, strategies: ['desktop'] })
      expect(measured.desktop).not.toBeNull()
      const flags = runPerformanceChecks(measured.desktop, null).map(flag => ({ ...flag, pageUrl }))
      expect(flags.map(flag => flag.checkId)).toEqual(['perf-score-critical', 'render-blocking', 'unused-js-large', 'unused-css-large', 'unoptimized-images'])
      // The historical source is created from the real collector and detector.
      // Fresh verification uses normal admission, queue and application workers.
      const source = await prisma.audit.create({ data: { projectId, userId, url: pageUrl, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), performanceData: { desktop: measured.desktop! } } })
      await persistDeterministicFlags(source.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
      await materializeAttentionForAudit(source.id)
      const findings = await prisma.flag.findMany({ where: { auditId: source.id } })
      const attempts = new Map<string, string>()
      for (const flag of findings) attempts.set(flag.id, (await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
        idempotencyKey: 'performance-fix:' + flag.id, changeSummary: 'Remove unnecessary resources and improve loading' })).attemptId)
      const unusedJs = findings.find(flag => flag.checkId === 'unused-js-large')!
      async function verify(flag: typeof unusedJs, phase: string) {
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'DIAGNOSTIC',
          idempotencyKey: 'performance-verify:' + flag.id + ':' + phase,
          verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: flag.checkId!, parentAuditId: source.id, attemptId: attempts.get(flag.id)! } })
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: run.auditId!, targetKey: { startsWith: 'task:' } }, select: { workKind: true } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'pagespeed'])
        return run
      }
      pageSpeedMode = 'missing'
      const unknown = await verify(unusedJs, 'missing')
      expect(await prisma.improvementAttempt.findUnique({ where: { id: attempts.get(unusedJs.id)! } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.flag.findUnique({ where: { id: unusedJs.id } })).toMatchObject({ status: 'OPEN' })
      expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: unknown.auditId!, targetKey: 'check:unused-js-large' } })).toBeNull()
      const unknownAudit = await prisma.audit.findUniqueOrThrow({ where: { id: unknown.auditId! } })
      const unknownReceipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: unknown.auditId! },
        select: { targetKey: true, status: true, detail: true } })
      const scoreFlag = findings.find(flag => flag.checkId === 'perf-score-critical')!
      expect(hasRecordedRecoveryEvidence({ auditId: unknown.auditId!, executionSpec: unknownAudit.executionSpec,
        flag: scoreFlag, executions: unknownReceipts })).toBe(true)
      expect(hasRecordedRecoveryEvidence({ auditId: unknown.auditId!, executionSpec: unknownAudit.executionSpec,
        flag: unusedJs, executions: unknownReceipts })).toBe(false)
      pageSpeedMode = 'healthy'
      for (const flag of findings) {
        // A fresh verification attempt follows the inconclusive resource check.
        if (flag.id === unusedJs.id) attempts.set(flag.id, (await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId,
          idempotencyKey: 'performance-fix-after-gap', changeSummary: 'Confirm the newly measured resource savings' })).attemptId)
        const repaired = await verify(flag, 'healthy')
        expect(await prisma.improvementAttempt.findUnique({ where: { id: attempts.get(flag.id)! } })).toMatchObject({ outcome: 'IMPROVED', comparable: true,
          verificationAuditId: repaired.auditId })
        expect(await prisma.flag.findUnique({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.auditId })
        expect(await prisma.flag.count({ where: { auditId: repaired.auditId! } })).toBe(0)
        const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: repaired.auditId!, targetKey: 'check:' + flag.checkId } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'pagespeed-desktop' })
      }
    } finally { pageSpeedMode = null }
  }, 45_000)

  it('keeps two availability responsibilities independent even when their binding keys match', async () => {
    const transport = fixtureTransport()
    try {
      const original = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
      const other = await prisma.siteOutcome.create({ data: { projectId, slug: 'other-page', name: 'Another public page', kind: 'AVAILABILITY',
        confirmedAt: new Date(), bindings: { create: { key: 'page-availability-v1', mechanism: 'HTTP_AVAILABILITY', required: true,
          config: { startUrl: origin + '/independent-page', expectedSelector: 'body' } } } } })
      const ids: string[] = []
      for (const [index, rootFails] of [true, false].entries()) {
        availabilityStatus = rootFails ? 503 : 200
        otherAvailabilityStatus = rootFails ? 200 : 503
        const run = await requestSiteRun({ projectId, userId, outcomeIds: [original.id, other.id], source: 'WATCH', idempotencyKey: 'independent-pages:' + index })
        ids.push(run.auditId!)
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
        }, { timeout: 15_000, interval: 100 })
      }
      const first = await prisma.flag.findFirstOrThrow({ where: { auditId: ids[0], checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
      const second = await prisma.flag.findFirstOrThrow({ where: { auditId: ids[1], checkId: 'outcome-availability-failed' }, include: { improvementOccurrence: true } })
      expect(first).toMatchObject({ status: 'FIXED', resolvedInId: ids[1] })
      expect(second.status).toBe('OPEN')
      expect(first.fingerprint).not.toBe(second.fingerprint)
      expect(first.improvementOccurrence!.improvementId).not.toBe(second.improvementOccurrence!.improvementId)
      expect(await prisma.outcomeAssessment.findMany({ where: { auditId: ids[1] }, select: { outcomeId: true, state: true } })).toEqual(expect.arrayContaining([
        { outcomeId: original.id, state: 'CLEAR' }, { outcomeId: other.id, state: 'FLAG' },
      ]))
    } finally { availabilityStatus = 200; otherAvailabilityStatus = 200; transport.mockRestore() }
  }, 30_000)

})
