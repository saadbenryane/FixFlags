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
import { projectCheckResults } from '@/lib/sites/check-results'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('migrated progressive execution', () => {
  const suffix = randomUUID()
  const userId = 'execution-user-' + suffix
  const projectId = 'execution-project-' + suffix
  const origin = 'https://example.com'
  let releaseResources!: () => void
  const resources = new Promise<void>(resolve => { releaseResources = resolve })
  const requests: string[] = []
  let focusRepaired = false
  let restorationRepaired = false
  const server = createServer(async (req, res) => {
    requests.push(req.url!)
    if (req.url === '/sitemap.xml' || req.url === '/canonical') await resources
    if (res.destroyed) return
    if (req.url === '/robots.txt') {
      res.setHeader('content-type', 'text/plain')
      res.end('User-agent: *\nDisallow: /private\nSitemap: ' + origin + '/sitemap.xml')
    } else if (req.url === '/sitemap.xml') {
      res.setHeader('content-type', 'application/xml')
      res.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + '/</loc></url></urlset>')
    } else if (req.url === '/cleanup') {
      let body = ''
      for await (const chunk of req) body += chunk
      const operationId = (JSON.parse(body) as { operationId: string }).operationId
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true, operationId, settled: false }))
    } else if (req.url === '/canonical') {
      res.writeHead(404); res.end('Missing canonical destination')
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
      res.end('<!doctype html><html lang="en"><head><title>Execution fixture</title><link rel="canonical" href="/canonical"></head><body><main><h1>Execution fixture</h1></main></body></html>')
    }
  })
  let worker: ReturnType<typeof startWorker> | undefined

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
      if (url.origin !== origin) throw new Error('External service unavailable in this fixture')
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
    const originalSession = pageSessions.createAuditPage
    const transport = vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => originalSession(browser, url, {
      ...options, configurePage: async page => {
        await options.configurePage?.(page)
        // Serve controlled HTML through real Chromium. Retain the production
        // mutation guard rather than granting the fixture implicit submission consent.
        await page.route(origin + '/**', route => applyJourneyRouteGuards(route, async () => {
          const response = await fetch(route.request().url())
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers.entries()), body: await response.text() })
        }))
      },
    }))
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
})
