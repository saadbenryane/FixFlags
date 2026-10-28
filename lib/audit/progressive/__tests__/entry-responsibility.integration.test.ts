import { randomUUID } from 'node:crypto'
import { Prisma, type AuditPage } from '@prisma/client'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { claimAnonymousAudits } from '@/lib/audit/claim-anonymous'
import { processDueProjectWatches } from '@/lib/audit/project-watch'
import { fixedClock } from '@/lib/time/clock'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { monitoringBehaviorResponsibility } from '@/lib/sites/application/monitoring-responsibility'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { TASK_QUEUES } from '../queues'
import { dispatchReadyTasks, reconcileTasks } from '../engine'

const cookies = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (key: string) => cookies.has(key) ? { value: cookies.get(key) } : undefined,
  set: (key: string, value: string) => cookies.set(key, value), delete: (key: string) => cookies.delete(key),
}), headers: async () => new Headers({ host: 'localhost:3000' }) }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('original entry responsibility after URL-first claim and monitoring admission', () => {
  const owner = 'entry-responsibility-' + randomUUID(), origin = 'https://example.com', entry = origin + '/pricing/?plan=teams'
  const fixtureOwners = [owner]
  const requests: string[] = []
  const brokenEntries = new Set<string>()
  let heldEntry: { url: string; wait: Promise<void>; release: () => void } | undefined
  let discoveredInteraction = false
  let interactionRepaired = false
  let repaired = false, repairedRoute = false, browserRoutes = false, baseDestinationRepaired = false, worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.setHeader('content-type', 'text/plain'); response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') { response.statusCode = 404; response.end('Unavailable'); return }
    if (request.url === '/document-base-destination/' && !baseDestinationRepaired) response.statusCode = 404
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head>' +
      (request.url === '/document-base-entry' ? '<base href="/document-base-destination/">' : '') +
      (request.url === '/pricing/?plan=teams' && !repaired || brokenEntries.has(origin + request.url) ? '' : '<title>Useful public service</title>') +
      '<meta name="description" content="Explore useful plans for your team."></head>' +
      '<body><main><h1>Useful public service</h1><p>Compare the available plans for your team.</p>' +
      (discoveredInteraction && request.url === '/' ? '<a href="/discovered-action">Explore the service</a>' : '') +
      (request.url === '/interaction-entry' || request.url === '/discovered-action' ? '<button id="entry-action"' + (interactionRepaired ? '' : ' disabled') +
        ' onclick="location.href=\'/interaction-next\'">Get started free</button>' : '') +
      (request.url === '/document-base-entry' ? '<a href="#plans">Compare the plans</a>' : '') +
      (browserRoutes && request.url === '/' ? '<button id="route-action" type="button">Choose plan</button><script>' +
        'if(location.hash === "#/pricing/" && !' + JSON.stringify(repairedRoute) + ') document.getElementById("route-action").textContent = "";' +
        '</script>' : '') + '</main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    vi.stubEnv('BETTER_AUTH_SECRET', 'local-entry-responsibility-proof-at-least-32-characters')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('External transport unavailable in this fixture')
      requests.push(url.href)
      if (url.href === heldEntry?.url) return heldEntry.wait.then(() => nativeFetch(transport + url.pathname + url.search, options))
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    const original = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => original(browser, url, { ...options,
      configurePage: async page => {
        await options.configurePage?.(page)
        await page.route('**', async route => {
          const resource = new URL(route.request().url())
          if (resource.origin !== origin) { await route.abort('blockedbyclient'); return }
          requests.push(resource.href)
          if (resource.href === heldEntry?.url) await heldEntry.wait
          const response = await nativeFetch(transport + resource.pathname + resource.search)
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
        })
      },
    }))
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', role: 'admin', auditsLimit: 100 } })
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const browser = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: browser.connected, activeBrowserContexts: browser.activeContexts, queueState: 'idle' })
  })
  afterAll(async () => {
    heldEntry?.release()
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    await prisma.user.deleteMany({ where: { id: { in: fixtureOwners } } })
    for (const queue of [getAuditQueue(), ...(Object.keys(TASK_QUEUES) as Array<keyof typeof TASK_QUEUES>).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs()
    await prisma.$disconnect()
  })
  async function complete(auditId: string, keepPrimaryActions = false, keepJourneys = false) {
    await vi.waitFor(async () => {
      // Provider, media and unrelated action work stays explicitly unavailable.
      await prisma.auditExecutionTask.updateMany({ where: { auditId, workState: { not: 'COMPLETED' }, OR: [
        { workKind: { notIn: ['http', 'browser', 'check', 'finalize', 'bindings', 'search', 'search-resources', 'discovery', ...(keepPrimaryActions ? ['flow'] : []), ...(keepJourneys ? ['journeys'] : [])] } },
        ...(keepPrimaryActions ? ['form-validation', 'mobile-navigation', 'pricing-navigation'].map(module => ({ workKind: 'flow', workInput: { path: ['module'], equals: module } })) : []),
      ] }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 60_000, interval: 100 })
  }
  // Page identity links can be filled by projection after collection. Compare
  // the original observations independently of that association's write time.
  const pageFacts = (pages: AuditPage[]) => pages.map(page => Object.fromEntries(Object.entries(page)
    .filter(([key]) => key !== 'pageId' && key !== 'updatedAt')))
  it('inherits a staging finding environment through independent verification, replay and recurrence', async () => {
    const owner = 'staging-verification-' + randomUUID(), target = origin + '/pricing/?plan=teams'
    fixtureOwners.push(owner)
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', role: 'admin', auditsLimit: 100 } })
    const initial = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: origin + '/',
    userId: owner })
    await complete(initial.auditId)
    const site = (await loadSiteRecord(initial.siteId!))!
    repaired = false
    try {
      const stage = await requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], source: 'WEB', scope: 'SITE',
        environment: 'staging', url: target, idempotencyKey: 'staging-source' })
      await complete(stage.auditId!)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: stage.auditId!, pageUrl: target, checkId: 'title-missing' } })
      const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      const receipts: Array<{ attemptId: string; idempotencyKey: string; auditId: string }> = []
      for (const outcome of ['UNCHANGED', 'IMPROVED'] as const) {
        repaired = outcome === 'IMPROVED'
        const fix = await recordSiteFlagFix({ siteId: site.siteId, userId: owner, flagId: flag.id,
          idempotencyKey: 'staging-fix-' + outcome, changeSummary: 'Restore the staged page title' })
        const command = { type: 'VERIFY_FLAG' as const, siteId: site.siteId, userId: owner, flagId: flag.id,
          attemptId: fix.attemptId, idempotencyKey: 'staging-verify-' + outcome }
        const verification = await executeSiteCommand(command)
        if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Staging verification was not admitted')
        receipts.push({ attemptId: fix.attemptId, idempotencyKey: command.idempotencyKey, auditId: verification.verificationAuditId! })
        await complete(verification.verificationAuditId!)
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: verification.verificationAuditId! } })).toMatchObject({ executionSpec: { environment: 'staging' } })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: true })
        const count = await prisma.audit.count({ where: { projectId: site.projectId! } })
        expect(await executeSiteCommand(command)).toMatchObject({ verificationAuditId: verification.verificationAuditId })
        expect(await prisma.audit.count({ where: { projectId: site.projectId! } })).toBe(count)
      }
      repaired = false
      const recurring = await requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], source: 'WEB', scope: 'SITE',
        environment: 'staging', url: target, idempotencyKey: 'staging-recurring' })
      await complete(recurring.auditId!)
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, pageUrl: target, checkId: 'title-missing' } })
      expect(repeated).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: occurrence.improvementId })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ evidence: flag.evidence })
      const count = await prisma.audit.count({ where: { projectId: site.projectId! } })
      for (const receipt of receipts) expect(await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.siteId, userId: owner,
        flagId: occurrence.improvementId, attemptId: receipt.attemptId, idempotencyKey: receipt.idempotencyKey }))
        .toMatchObject({ verificationAuditId: receipt.auditId, parentAuditId: stage.auditId })
      expect(await prisma.audit.count({ where: { projectId: site.projectId! } })).toBe(count)
    } finally { repaired = false }
  }, 180_000)
  it('keeps a legacy staging run out of a production comparison and refuses a cross-environment parent', async () => {
    const owner = 'environment-parent-' + randomUUID(), target = origin + '/'
    fixtureOwners.push(owner)
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', role: 'admin', auditsLimit: 100 } })
    const initial = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: target,
    userId: owner })
    await complete(initial.auditId)
    const site = (await loadSiteRecord(initial.siteId!))!
    brokenEntries.add(target)
    let staged
    try {
      staged = await requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WEB',
        environment: 'staging', url: target, idempotencyKey: 'legacy-staging-source' })
      await complete(staged.auditId!)
    } finally { brokenEntries.delete(target) }
    const stagedFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: staged.auditId!, pageUrl: target, checkId: 'title-missing' } })
    // Emulate the historical storage boundary after collecting real evidence.
    // The original RunRequest still carries the full frozen staging intent.
    const legacy = await prisma.audit.update({ where: { id: staged.auditId! }, data: { executionSpec: Prisma.DbNull } })
    const legacyRequest = await prisma.runRequest.findUniqueOrThrow({ where: { id: staged.runId } })
    const before = await prisma.audit.count({ where: { projectId: site.projectId! } })
    await expect(requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WEB',
      environment: 'production', parentAuditId: legacy.id, idempotencyKey: 'wrong-environment-parent' })).rejects.toMatchObject({ status: 409 })
    expect(await prisma.audit.count({ where: { projectId: site.projectId! } })).toBe(before)
    const next = await requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WEB',
      environment: 'production', idempotencyKey: 'owned-production-comparison' })
    await complete(next.auditId!)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: next.auditId! } })).toMatchObject({ parentId: initial.auditId, executionSpec: { environment: 'production' } })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: next.runId } })).toMatchObject({ environment: 'production' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: legacy.id } })).toMatchObject({ executionSpec: null, completedAt: legacy.completedAt })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: legacyRequest.id } })).toMatchObject({ environment: 'staging', executionSpec: legacyRequest.executionSpec })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: stagedFlag.id } }))
      .toMatchObject({ status: 'OPEN', resolvedInId: null, evidence: stagedFlag.evidence })
    const stagedRecovery = await requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], scope: 'SITE', source: 'WEB',
      environment: 'staging', url: target, idempotencyKey: 'matching-staging-recovery' })
    await complete(stagedRecovery.auditId!)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: stagedRecovery.auditId! } })).toMatchObject({ parentId: legacy.id })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: stagedFlag.id } }))
      .toMatchObject({ status: 'FIXED', resolvedInId: stagedRecovery.auditId, evidence: stagedFlag.evidence })
  }, 120_000)
  it('retains the specific discovered-page action checked by a category through ordinary monitoring, repair and recurrence', async () => {
    const owner = 'discovered-action-' + randomUUID(), target = origin + '/discovered-action'
    fixtureOwners.push(owner)
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', role: 'admin', auditsLimit: 100 } })
    discoveredInteraction = true; interactionRepaired = false
    try {
      const initial = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: origin + '/',
    userId: owner })
      await complete(initial.auditId)
      expect(await prisma.auditPage.findFirst({ where: { auditId: initial.auditId, url: target } })).not.toBeNull()
      const site = (await loadSiteRecord(initial.siteId!))!
      const category = await requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], source: 'WEB',
        scope: 'CATEGORY', categoryArea: 'conversion', idempotencyKey: 'discovered-action-category' })
      await complete(category.auditId!, true)
      const original = await prisma.flag.findFirstOrThrow({ where: { auditId: category.auditId!, pageUrl: target, checkId: 'flow-cta-unclickable' } })
      const responsibility = await monitoringBehaviorResponsibility({ projectId: site.projectId!, environment: 'production', pages: [origin + '/', target] })
      expect(responsibility.find(scope => scope.pageUrl === target)?.behaviors).toContain('flow')
      discoveredInteraction = false
      const due = (await prisma.project.findUniqueOrThrow({ where: { id: site.projectId! } })).watchNextRunAt!
      expect(site.watchInterval).toBe('daily')
      const nextCarePeriod = new Date(due.getTime() + 2 * 86_400_000)
      expect(await processDueProjectWatches(1, { onlyProjectId: site.projectId!, clock: fixedClock(nextCarePeriod) })).toMatchObject({ enqueued: 1, errors: 0 })
      const watch = await prisma.runRequest.findFirstOrThrow({ where: { projectId: site.projectId!, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } })
      expect((await prisma.audit.findUniqueOrThrow({ where: { id: watch.auditId! } })).executionSpec).toMatchObject({ scope: 'SITE' })
      await complete(watch.auditId!, true)
      expect(await prisma.auditExecutionTask.findFirst({ where: { auditId: watch.auditId!, workKind: 'flow', pageUrl: target,
        targetKey: { endsWith: ':flow' } } })).not.toBeNull()
      expect(await prisma.auditExecutionTask.count({ where: { auditId: watch.auditId!, workKind: { in: ['journeys', 'slow-replay'] }, pageUrl: target } })).toBe(0)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, pageUrl: target, checkId: 'flow-cta-unclickable' } })
      expect((await loadSiteHome(site.siteId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: flag.id }))
      expect(await getOwnedRun(owner, watch.id)).toMatchObject({ result: 'FLAG' })
      const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      for (const outcome of ['UNCHANGED', 'IMPROVED'] as const) {
        interactionRepaired = outcome === 'IMPROVED'
        const fix = await recordSiteFlagFix({ siteId: site.siteId, userId: owner, flagId: flag.id,
          idempotencyKey: 'discovered-fix-' + outcome, changeSummary: 'Enable the discovered public action' })
        const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.siteId, userId: owner, flagId: flag.id,
          attemptId: fix.attemptId, idempotencyKey: 'discovered-verify-' + outcome })
        if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Discovered action verification was not admitted')
        await complete(verification.verificationAuditId!, true)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: true })
      }
      interactionRepaired = false
      const recurring = await requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], source: 'WATCH', scope: 'SITE', idempotencyKey: 'discovered-action-recurring' })
      await complete(recurring.auditId!, true)
      const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, pageUrl: target, checkId: 'flow-cta-unclickable' } })
      expect(repeated).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      expect((await loadSiteHome(site.siteId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: repeated.id }))
      expect(await getOwnedRun(owner, recurring.runId)).toMatchObject({ result: 'FLAG' })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: occurrence.improvementId })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ evidence: original.evidence })
    } finally { discoveredInteraction = false; interactionRepaired = false }
  }, 180_000)
  it('keeps the original entry action under root monitoring after claim, repair and recurrence', async () => {
    const owner = 'entry-action-responsibility-' + randomUUID(), target = origin + '/interaction-entry'
    fixtureOwners.push(owner)
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', role: 'admin', auditsLimit: 100 } })
    const anonymous = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: target,
    visitorKey: 'entry-action-' + randomUUID() })
    await complete(anonymous.auditId, true)
    const original = await prisma.flag.findFirstOrThrow({ where: { auditId: anonymous.auditId, checkId: 'flow-cta-unclickable', pageUrl: target } })
    expect(await claimAnonymousAudits(owner)).toBe(1)
    const site = (await loadSiteRecord(anonymous.siteId!))!
    expect(site.url).toBe(origin)
    const due = (await prisma.project.findUniqueOrThrow({ where: { id: site.projectId! } })).watchNextRunAt!
    expect(await processDueProjectWatches(1, { onlyProjectId: site.projectId!, clock: fixedClock(due) })).toMatchObject({ enqueued: 1, errors: 0 })
    const scheduled = await prisma.runRequest.findFirstOrThrow({ where: { projectId: site.projectId!, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } })
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: scheduled.auditId! } })).executionSpec).toMatchObject({ monitoringBehaviors: [origin + '/', target].map(pageUrl => ({ pageUrl, behaviors: ['flow', 'pricing-navigation', 'slow-replay', 'journeys'] })) })
    await complete(scheduled.auditId!, true, true)
    expect(await prisma.journeyReview.count({ where: { auditId: scheduled.auditId!, startUrl: target } })).toBeGreaterThan(0)
    expect(await prisma.auditExecutionTask.findFirst({ where: { auditId: scheduled.auditId!, workKind: 'journeys', pageUrl: target } })).toMatchObject({ workState: 'COMPLETED' })
    expect(await prisma.auditExecutionTask.findFirst({ where: { auditId: scheduled.auditId!, workKind: 'flow', pageUrl: target,
      targetKey: { endsWith: ':flow' } } })).not.toBeNull()
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: scheduled.auditId!, checkId: 'flow-cta-unclickable', pageUrl: target } })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    for (const outcome of ['UNCHANGED', 'IMPROVED'] as const) {
      interactionRepaired = outcome === 'IMPROVED'
      const fix = await recordSiteFlagFix({ siteId: site.siteId, userId: owner, flagId: flag.id,
        idempotencyKey: 'entry-action-fix-' + outcome, changeSummary: 'Enable the original entry action' })
      const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.siteId, userId: owner, flagId: flag.id,
        attemptId: fix.attemptId, idempotencyKey: 'entry-action-verify-' + outcome })
      if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Entry action verification was not admitted')
      await complete(verification.verificationAuditId!, true)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: true })
    }
    interactionRepaired = false
    const recurring = await requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], source: 'WATCH', scope: 'SITE', idempotencyKey: 'entry-action-recurring' })
    await complete(recurring.auditId!, true)
    const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'flow-cta-unclickable', pageUrl: target } })
    expect(repeated).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: occurrence.improvementId })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ pageUrl: target, evidence: original.evidence })
  }, 180_000)
  it('keeps the exact entry page through signed claim, a due root check, independent repair and recurring monitoring', async () => {
    const anonymous = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: entry,
    visitorKey: 'entry-' + randomUUID() })
    await complete(anonymous.auditId)
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: anonymous.auditId }, include: { pages: true } })
    const sourceFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: original.id, checkId: 'title-missing', pageUrl: entry } })
    expect(await claimAnonymousAudits(owner)).toBe(1)
    const site = (await loadSiteRecord(anonymous.siteId!))!
    expect(site).toMatchObject({ kind: 'project', userId: owner, url: origin, primaryAuditId: original.id })
    const projectId = site.projectId!
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ userId: owner, projectId,
      completedAt: original.completedAt, url: entry, executionSpec: original.executionSpec })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: sourceFlag.id } })).toEqual(sourceFlag)
    expect((await loadSiteHome(site.siteId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: sourceFlag.id }))
    const due = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt!
    const priorRequests = requests.filter(url => url === entry).length
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId, clock: fixedClock(due) })).toMatchObject({ enqueued: 1, errors: 0 })
    const watch = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } })
    const admitted = await prisma.audit.findUniqueOrThrow({ where: { id: watch.auditId! } })
    expect(admitted.executionSpec).toMatchObject({ scope: 'SITE', targetUrl: origin + '/', monitoringPages: [origin + '/', entry] })
    await complete(admitted.id)
    expect(requests.filter(url => url === entry).length).toBeGreaterThan(priorRequests)
    expect(await prisma.auditPage.findFirstOrThrow({ where: { auditId: admitted.id, url: entry } })).toMatchObject({ status: 'COMPLETED' })
    const observed = await prisma.flag.findFirstOrThrow({ where: { auditId: admitted.id, checkId: 'title-missing', pageUrl: entry } })
    expect(await getOwnedRun(owner, watch.id)).toMatchObject({ result: 'FLAG' })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: observed.id } })
    repaired = true
    const fix = await recordSiteFlagFix({ siteId: site.siteId, userId: owner, flagId: observed.id, idempotencyKey: 'entry-fix', changeSummary: 'Restore the title on the original pricing page' })
    const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.siteId, userId: owner, flagId: observed.id,
      attemptId: fix.attemptId, idempotencyKey: 'entry-verify' })
    if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Entry verification was not admitted')
    await complete(verification.verificationAuditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    repaired = false
    // Exercise another monitoring run from the configured Site target. The first
    // admission above separately proves the scheduler's saved due claim.
    const recurring = await requestSiteRun({ projectId, userId: owner, outcomeIds: [], source: 'WATCH', scope: 'SITE', idempotencyKey: 'entry-recurrence' })
    await complete(recurring.auditId!)
    const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'title-missing', pageUrl: entry } })
    expect(repeated).toMatchObject({ status: 'REGRESSED', fingerprint: observed.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: occurrence.improvementId })
    expect(await getOwnedRun(owner, recurring.runId)).toMatchObject({ result: 'FLAG' })
    expect(pageFacts(await prisma.auditPage.findMany({ where: { auditId: original.id }, orderBy: { position: 'asc' } }))).toEqual(pageFacts(original.pages))
  }, 180_000)
  it('combines independently analyzed entry pages when successive claims attach to one Site', async () => {
    const entries = [origin + '/plans/?tier=teams', origin + '/support/?topic=billing']
    repaired = true
    brokenEntries.add(entries[0])
    const originals = []
    for (const url of entries) {
      const admitted = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url,
    visitorKey: 'independent-entry-' + randomUUID() })
      await complete(admitted.auditId)
      originals.push(await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId }, include: { pages: true, flags: true } }))
      expect(await claimAnonymousAudits(owner)).toBe(1)
    }
    const project = await prisma.project.findFirstOrThrow({ where: { userId: owner } })
    for (const source of originals) {
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ projectId: project.id, userId: owner,
        url: source.url, executionSpec: source.executionSpec, completedAt: source.completedAt })
      for (const flag of source.flags) expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } }))
        .toMatchObject({ id: flag.id, checkId: flag.checkId, pageUrl: flag.pageUrl, evidence: flag.evidence,
          supportingObservations: flag.supportingObservations, evidenceTargets: flag.evidenceTargets })
    }
    const watch = await requestSiteRun({ projectId: project.id, userId: owner, outcomeIds: [], source: 'WATCH', scope: 'SITE',
      idempotencyKey: 'combined-entry-watch' })
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: watch.auditId! } })).executionSpec)
      .toMatchObject({ monitoringPages: expect.arrayContaining([origin + '/', ...entries]) })
    await complete(watch.auditId!)
    for (const url of entries) {
      expect(await prisma.auditPage.findFirstOrThrow({ where: { auditId: watch.auditId!, url } })).toMatchObject({ status: 'COMPLETED' })
      expect(requests).toContain(url)
    }
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: 'title-missing', pageUrl: entries[0] } })
    const siteId = (await loadSiteRecord(project.id))!.siteId
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    brokenEntries.delete(entries[0])
    const fix = await recordSiteFlagFix({ siteId, userId: owner, flagId: flag.id, idempotencyKey: 'combined-entry-fix', changeSummary: 'Restore the original plan title' })
    const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId: owner, flagId: flag.id,
      attemptId: fix.attemptId, idempotencyKey: 'combined-entry-verify' })
    if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Combined entry verification was not admitted')
    await complete(verification.verificationAuditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    brokenEntries.add(entries[0])
    const recurring = await requestSiteRun({ projectId: project.id, userId: owner, outcomeIds: [], source: 'WATCH', scope: 'SITE',
      idempotencyKey: 'combined-entry-recurrence' })
    await complete(recurring.auditId!)
    const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'title-missing', pageUrl: entries[0] } })
    expect(repeated).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: occurrence.improvementId })
    for (const source of originals) expect(pageFacts(await prisma.auditPage.findMany({ where: { auditId: source.id }, orderBy: { position: 'asc' } })))
      .toEqual(pageFacts(source.pages))
  }, 180_000)
  it('keeps an admitted entry when signup claims the Site before collection can finish', async () => {
    const url = origin + '/during-signup/?plan=teams'
    let release!: () => void
    heldEntry = { url, wait: new Promise<void>(resolve => { release = resolve }), release: () => release() }
    try {
      const anonymous = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url,
    visitorKey: 'inflight-entry-' + randomUUID() })
      expect((await prisma.audit.findUniqueOrThrow({ where: { id: anonymous.auditId } })).status).not.toBe('COMPLETED')
      expect(await claimAnonymousAudits(owner)).toBe(1)
      const site = (await loadSiteRecord(anonymous.siteId!))!
      const watch = await requestSiteRun({ projectId: site.projectId!, userId: owner, outcomeIds: [], source: 'WATCH', scope: 'SITE',
        idempotencyKey: 'inflight-entry-watch' })
      expect((await prisma.audit.findUniqueOrThrow({ where: { id: watch.auditId! } })).executionSpec)
        .toMatchObject({ monitoringPages: expect.arrayContaining([origin + '/', url]) })
      heldEntry.release()
      await complete(anonymous.auditId)
      await complete(watch.auditId!)
      expect(await prisma.auditPage.findFirstOrThrow({ where: { auditId: watch.auditId!, url } })).toMatchObject({ status: 'COMPLETED' })
      expect((await prisma.audit.findUniqueOrThrow({ where: { id: anonymous.auditId } })).executionSpec).toMatchObject({ targetUrl: url })
    } finally { heldEntry.release(); heldEntry = undefined }
  }, 180_000)
  it('keeps a base-resolved public destination through collection, independent repair and root monitoring', async () => {
    const owner = 'document-base-responsibility-' + randomUUID()
    fixtureOwners.push(owner)
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', role: 'admin', auditsLimit: 100 } })
    const source = origin + '/document-base-entry', destination = origin + '/document-base-destination/'
    const anonymous = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: source,
    visitorKey: 'document-base-' + randomUUID() })
    await complete(anonymous.auditId)
    const original = await prisma.flag.findFirstOrThrow({ where: { auditId: anonymous.auditId, checkId: 'broken-internal-links', pageUrl: source } })
    expect(requests).toContain(destination)
    expect(await claimAnonymousAudits(owner)).toBe(1)
    const site = (await loadSiteRecord(anonymous.siteId!))!
    for (const outcome of ['UNCHANGED', 'IMPROVED'] as const) {
      baseDestinationRepaired = outcome === 'IMPROVED'
      const fix = await recordSiteFlagFix({ siteId: site.siteId, userId: owner, flagId: original.id,
        idempotencyKey: 'document-base-fix-' + outcome, changeSummary: 'Restore the linked plan document' })
      const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.siteId, userId: owner, flagId: original.id,
        attemptId: fix.attemptId, idempotencyKey: 'document-base-verify-' + outcome })
      if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Public destination verification was not admitted')
      await complete(verification.verificationAuditId!)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: true })
    }
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: original.id } })
    baseDestinationRepaired = false
    const recurring = await requestSiteRun({ projectId: site.projectId!, userId: owner, scope: 'SITE', outcomeIds: [], source: 'WATCH',
      idempotencyKey: 'document-base-recurrence' })
    await complete(recurring.auditId!)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: recurring.auditId! } })).toMatchObject({ url: origin + '/' })
    const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'broken-internal-links', pageUrl: source } })
    expect(repeated).toMatchObject({ status: 'REGRESSED', fingerprint: original.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: occurrence.improvementId })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ evidence: original.evidence, pageUrl: source })
  }, 180_000)

  it('keeps a supplied browser route through claim, monitoring, exact verification and recurrence', async () => {
    const owner = 'browser-route-responsibility-' + randomUUID()
    fixtureOwners.push(owner)
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', role: 'admin', auditsLimit: 100 } })
    browserRoutes = true
    const target = origin + '/#/pricing/', peer = origin + '/#/help'
    const anonymous = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: target,
    visitorKey: 'browser-route-' + randomUUID() })
    await complete(anonymous.auditId)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: anonymous.auditId } }))
      .toMatchObject({ url: target, executionSpec: { targetUrl: target } })
    const original = await prisma.flag.findFirstOrThrow({ where: { auditId: anonymous.auditId, checkId: 'buttons-no-text', pageUrl: target } })
    expect(await claimAnonymousAudits(owner)).toBe(1)
    const site = (await loadSiteRecord(anonymous.siteId!))!
    expect(site).toMatchObject({ url: origin, userId: owner })
    const due = (await prisma.project.findUniqueOrThrow({ where: { id: site.projectId! } })).watchNextRunAt!
    expect(await processDueProjectWatches(1, { onlyProjectId: site.projectId!, clock: fixedClock(due) })).toMatchObject({ enqueued: 1, errors: 0 })
    const scheduled = await prisma.runRequest.findFirstOrThrow({ where: { projectId: site.projectId!, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } })
    await complete(scheduled.auditId!)
    expect(await prisma.flag.findFirstOrThrow({ where: { auditId: scheduled.auditId!, checkId: 'buttons-no-text', pageUrl: target } }))
      .toMatchObject({ pageUrl: target })
    const observed = await requestSiteRun({ projectId: site.projectId!, userId: owner, url: peer, scope: 'SITE', outcomeIds: [],
      source: 'WEB', idempotencyKey: 'route-peer' })
    await complete(observed.auditId!)
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: observed.auditId! } })).executionSpec)
      .toMatchObject({ targetUrl: peer, monitoringPages: expect.arrayContaining([target, peer]) })
    expect(await prisma.sitePage.findMany({ where: { projectId: site.projectId!, url: { in: [target, peer] } }, select: { url: true } }))
      .toEqual(expect.arrayContaining([{ url: target }, { url: peer }]))
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: observed.auditId!, checkId: 'buttons-no-text', pageUrl: target } })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    const proofs = await prisma.auditVerificationReceipt.findMany({ where: { auditId: observed.auditId!, targetKey: 'module:accessibility',
      pageUrl: { in: [target, peer] } }, select: { pageUrl: true, scopeKey: true } })
    expect(proofs).toEqual(expect.arrayContaining([{ pageUrl: target, scopeKey: 'page:' + target }, { pageUrl: peer, scopeKey: 'page:' + peer }]))
    for (const outcome of ['UNCHANGED', 'IMPROVED'] as const) {
      repairedRoute = outcome === 'IMPROVED'
      const fix = await recordSiteFlagFix({ siteId: site.siteId, userId: owner, flagId: flag.id, idempotencyKey: 'route-fix-' + outcome,
        changeSummary: 'Give the pricing-route button an accessible name' })
      const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.siteId, userId: owner, flagId: flag.id,
        attemptId: fix.attemptId, idempotencyKey: 'route-verify-' + outcome })
      if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Route verification was not admitted')
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: verification.verificationAuditId! } })).toMatchObject({ url: target })
      await complete(verification.verificationAuditId!)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: true })
      expect(await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: verification.verificationAuditId!, targetKey: 'check:buttons-no-text' } }))
        .toMatchObject({ pageUrl: target, scopeKey: 'page:' + target })
    }
    repairedRoute = false
    const recurring = await requestSiteRun({ projectId: site.projectId!, userId: owner, scope: 'SITE', outcomeIds: [], source: 'WATCH', idempotencyKey: 'route-recurrence' })
    await complete(recurring.auditId!)
    const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'buttons-no-text', pageUrl: target } })
    expect(repeated).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: occurrence.improvementId })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ pageUrl: target, evidence: original.evidence })
  }, 240_000)
})
