import { TASK_QUEUES } from '../queues'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { requestScheduledSiteRun } from '@/lib/sites/application/scheduled-runs'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { getAuditBrowser, getBrowserDiagnostics, closeBrowser } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { checkVerifierSchema } from '@/lib/audit/checks/verification'
import { hasRecordedRecoveryEvidence } from '@/lib/audit/recovery-evidence'
import { reconcileTasks, dispatchReadyTasks } from '../engine'
import { recordedWorkComplete } from '../recorded-completeness'
import { categoryCoverageExecutionSelect } from '@/lib/sites/application/site-execution'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { processDueProjectWatches } from '@/lib/audit/project-watch'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Observed Site page monitoring continuity', () => {
  const userId = 'pages-' + randomUUID(), projectId = 'pages-' + randomUUID()
  const origin = 'https://example.com', peer = origin + '/pricing'
  let linked = true, repaired = false, oversizedEntry = false, pauseDiscoveredCollection = false
  let performance: 'failed' | 'partial' | 'missing-peer' | 'healthy' | null = null
  let representativePath = '/'
  let pageResponse: 'failed' | 'challenge' | 'healthy' = 'healthy'
  let worker: ReturnType<typeof startWorker> | undefined
  const requests: string[] = []
  const server = createServer((request, response) => {
    requests.push(request.url!)
    if (request.url!.startsWith('/psi?')) {
      const input = new URL(request.url!, 'http://fixture.test')
      const representative = new URL(input.searchParams.get('url')!).pathname === representativePath
      response.setHeader('content-type', 'application/json')
      if (performance === 'missing-peer' && !representative) {
        response.statusCode = 403; response.end(JSON.stringify({ error: 'Fixture measurement unavailable' })); return
      }
      const slow = performance === 'failed' || performance === 'partial' && !representative
      response.end(JSON.stringify({ lighthouseResult: { requestedUrl: input.searchParams.get('url'), finalUrl: input.searchParams.get('url'), lighthouseVersion: '13.0.0',
        configSettings: { formFactor: input.searchParams.get('strategy') ?? 'desktop', throttlingMethod: 'simulate', throttling: { cpuSlowdownMultiplier: 4 } },
        categories: { performance: { score: 0.95 } }, audits: {
        'largest-contentful-paint': { numericValue: slow ? 3500 : 1000 }, 'cumulative-layout-shift': { numericValue: 0 },
        'first-contentful-paint': { numericValue: 500 }, 'total-blocking-time': { numericValue: 0 },
        'render-blocking-insight': { score: 1, metricSavings: { FCP: 0 } },
        'unused-javascript': { score: 1, details: { overallSavingsBytes: 0 } },
        'unused-css-rules': { score: 1, details: { overallSavingsBytes: 0 } },
        'image-delivery-insight': { score: 1, details: { debugData: { wastedBytes: 0 } } },
      } } })); return
    }
    if (request.url === '/robots.txt') { response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml')
      response.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + '/</loc></url></urlset>'); return
    }
    const pricing = request.url === '/pricing'
    response.setHeader('content-type', 'text/html')
    if (pricing && pageResponse !== 'healthy') {
      response.statusCode = pageResponse === 'failed' ? 503 : 200
      response.end(pageResponse === 'failed' ? '<html><body>Service temporarily unavailable</body></html>'
        : '<html><head><title>Just a moment...</title></head><body>Checking your browser before continuing</body></html>')
      return
    }
    response.end('<!doctype html><html lang="en"><head>' + (!pricing || repaired ? '<title>' + (pricing ? 'Our prices' : 'Useful service') + '</title>' : '') +
      '<meta name="description" content="Useful information about our service."><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
      '<body><main><h1>' + (pricing ? 'Our prices' : 'Useful service information') + '</h1><p>Read how our service helps you manage your work.</p>' +
      (!pricing && linked ? '<a href="/pricing">See prices</a>' : '') +
      (!pricing && oversizedEntry ? '<div hidden>' + 'x'.repeat(1_100_000) + '</div>' : '') + '</main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname)) throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/pagespeedonline/')) {
        if (performance) return nativeFetch(transport + '/psi?' + url.searchParams.toString(), options)
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Provider unavailable in this local fixture' } }), {
          status: 403, headers: { 'content-type': 'application/json' },
        }))
      }
      if (url.origin !== origin) throw new Error('External service unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    const original = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => original(browser, url, { ...options,
      configurePage: async page => {
        if (pauseDiscoveredCollection && url === origin + '/') await getAuditTaskQueue('browser').pause()
        await options.configurePage?.(page)
        await page.route('**', async route => {
          const resource = new URL(route.request().url())
          if (resource.origin !== origin) { await route.abort('blockedbyclient'); return }
          const response = await nativeFetch(transport + resource.pathname + resource.search)
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
        })
      },
    }))
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Page continuity fixture', canonicalHost: 'example.com', url: origin + '/' } })
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const diagnostics = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: diagnostics.connected, activeBrowserContexts: diagnostics.activeContexts, queueState: 'idle' })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    for (const queue of [getAuditQueue(), ...(Object.keys(TASK_QUEUES) as Array<keyof typeof TASK_QUEUES>).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function complete(auditId: string) {
    try {
      await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, select: { improvementProjectedAt: true } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 120_000, interval: 200 })
    } catch (error) {
      const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, select: { status: true, failureCode: true, progressDetail: true } })
      const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId, targetKey: { startsWith: 'task:' }, workState: { not: 'COMPLETED' } },
        select: { targetKey: true, workState: true, workErrorCode: true, workDependencies: true, workAttempts: true } })
      throw new Error('Monitoring projection did not settle: ' + JSON.stringify({ audit, tasks }), { cause: error })
    }
  }
  it('discovers a page, keeps checking after its link disappears, independently recovers and preserves recurrence', async () => {
    oversizedEntry = true
    const first = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'pages-initial' })
    await complete(first.auditId!)
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: first.auditId! }, select: { failedModules: true } })).failedModules)
      .not.toEqual(expect.arrayContaining(['corridor']))
    expect(await prisma.auditPage.findFirst({ where: { auditId: first.auditId!, url: peer } })).not.toBeNull()
    expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: first.auditId!, workKind: 'browser', pageUrl: origin + '/' } }))
      .toMatchObject({ workResult: { data: { metadata: null, snapshot: { desktopHtmlTruncated: true,
        renderedSearchSnapshot: { sections: { links: { complete: true } } } } } } })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: first.auditId! } }))
      .toMatchObject({ evidenceCoverage: { metadata: false }, reportCompleteness: 'PARTIAL' })
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: first.auditId!, checkId: 'title-missing', pageUrl: peer } })
    linked = false; repaired = true; requests.length = 0
    const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
    const watch = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt: tick, now: tick })
    const admitted = await prisma.audit.findUniqueOrThrow({ where: { id: watch.auditId! } })
    expect(readExecutionSpec(admitted.executionSpec)).toMatchObject({ scope: 'SITE', monitoringPages: [origin + '/', peer] })
    expect(await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt: tick, now: tick })).toMatchObject({ auditId: watch.auditId, reused: true })
    await complete(watch.auditId!)
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: watch.auditId! }, select: { failedModules: true } })).failedModules)
      .not.toEqual(expect.arrayContaining(['corridor']))
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: watch.auditId! }, select: { reportCompleteness: true } }))
      .toMatchObject({ reportCompleteness: 'PARTIAL' })
    expect(requests).toContain('/pricing')
    const summary = await getFlagDiffSummary(admitted.parentId, watch.auditId!)
    expect(summary.fixed.map(item => item.id)).toContain(flag.id)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: watch.auditId })
    repaired = false; requests.length = 0
    const next = new Date(tick.getTime() + 8 * 24 * 60 * 60 * 1000)
    const recurring = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt: next, now: next })
    await complete(recurring.auditId!)
    expect(requests).toContain('/pricing')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'title-missing', pageUrl: peer } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    const source = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: source.improvementId })
    oversizedEntry = false
  }, 360_000)

  it('retains a newly discovered page after both collectors stop before creating its first row', async () => {
    const owner = userId + '-discovered-gap', siteId = projectId + '-discovered-gap'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Discovered page continuity fixture', canonicalHost: 'example.com', url: origin + '/',
      watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() - 60_000), notificationLevel: 'OFF' } })
    linked = true; repaired = false; pauseDiscoveredCollection = true
    try {
      expect(await processDueProjectWatches(1, { onlyProjectId: siteId })).toMatchObject({ enqueued: 1, errors: 0 })
      const first = await prisma.runRequest.findFirstOrThrow({ where: { projectId: siteId, source: 'WATCH' } })
      await vi.waitFor(async () => expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: first.auditId!, pageUrl: peer,
        workKind: 'browser', workState: 'READY' } })).not.toBeNull(), { timeout: 30_000, interval: 100 })
      const interrupted = await prisma.auditVerifierExecution.updateMany({ where: { auditId: first.auditId!, pageUrl: peer,
        workKind: { in: ['browser', 'captures'] }, workState: 'READY' }, data: { workRecoveryUntil: new Date(0) } })
      expect(interrupted.count).toBe(2)
      await dispatchReadyTasks(await reconcileTasks(first.auditId!))
      expect(await prisma.auditVerifierExecution.count({ where: { auditId: first.auditId!, pageUrl: peer,
        workKind: { in: ['browser', 'captures'] }, workState: 'EXHAUSTED', status: 'FAILED' } })).toBe(2)
      pauseDiscoveredCollection = false; await getAuditTaskQueue('browser').resume()
      await complete(first.auditId!)
      expect(readExecutionSpec((await prisma.audit.findUniqueOrThrow({ where: { id: first.auditId! } })).executionSpec)?.monitoringPages).toBeUndefined()
      expect(await prisma.auditPage.findFirst({ where: { auditId: first.auditId!, url: peer } })).toBeNull()
      expect((await loadSiteHome(siteId))?.presentation.coverage).toMatchObject({ pagesReached: 1, pagesExpected: 2, complete: false })
      expect((await loadSiteSummaries(owner))[0]?.presentation.coverage).toMatchObject({ pagesReached: 1, pagesExpected: 2, complete: false })
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: 'COMPLETED' })
      expect(await getOwnedRun(owner, first.id)).toMatchObject({ completionState: 'PARTIAL' })
      await vi.waitFor(async () => expect(await prisma.project.findUniqueOrThrow({ where: { id: siteId } }))
        .toMatchObject({ watchConsecutiveFailures: 1 }), { timeout: 10_000 })
      const retry = await prisma.project.findUniqueOrThrow({ where: { id: siteId } })
      expect(retry.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
      linked = false; requests.length = 0
      // Advance only admission's clock, keeping actual worker collection on the
      // real clock. This proves backoff policy without a fifteen-minute wait.
      await getAuditQueue().pause()
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        vi.setSystemTime(retry.watchNextRunAt!.getTime() + 1000)
        expect(await processDueProjectWatches(1, { onlyProjectId: siteId })).toMatchObject({ enqueued: 1, errors: 0 })
      } finally { vi.useRealTimers(); await getAuditQueue().resume() }
      const next = await prisma.runRequest.findFirstOrThrow({ where: { projectId: siteId, id: { not: first.id } } })
      expect(readExecutionSpec((await prisma.audit.findUniqueOrThrow({ where: { id: next.auditId! } })).executionSpec))
        .toMatchObject({ monitoringPages: [origin + '/', peer] })
      await complete(next.auditId!)
      expect(requests).toContain('/pricing')
      expect(await prisma.flag.findFirst({ where: { auditId: next.auditId!, pageUrl: peer, checkId: 'title-missing' } })).not.toBeNull()
      // Provider observations remain unavailable in this local fixture. That
      // ordinary partial result is distinct from the recovered task exhaustion.
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: next.auditId! } }))
        .toMatchObject({ status: 'COMPLETED', reportCompleteness: 'PARTIAL' })
      await vi.waitFor(async () => expect(await prisma.project.findUniqueOrThrow({ where: { id: siteId } }))
        .toMatchObject({ watchConsecutiveFailures: 0, watchLastError: null }), { timeout: 10_000 })
      expect(await prisma.auditVerifierExecution.count({ where: { auditId: first.auditId!, pageUrl: peer,
        workKind: { in: ['browser', 'captures'] }, workState: 'EXHAUSTED', status: 'FAILED' } })).toBe(2)
    } finally { vi.useRealTimers(); pauseDiscoveredCollection = false; await getAuditQueue().resume(); await getAuditTaskQueue('browser').resume(); linked = true; repaired = false }
  }, 180_000)

  it('keeps the recorded page cohort in a category recheck after collection stops before creating its page row', async () => {
    const owner = userId + '-category-gap', siteId = projectId + '-category-gap'
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: siteId, userId: owner, name: 'Category continuity fixture', canonicalHost: 'example.com', url: origin + '/' } })
    linked = true; repaired = false; oversizedEntry = false
    try {
      const first = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'category-gap-source' })
      await complete(first.auditId!)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: first.auditId!, checkId: 'title-missing', pageUrl: peer } })
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      linked = false
      await getAuditTaskQueue('browser').pause()
      const gap = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'category-gap-interrupted' })
      expect(readExecutionSpec((await prisma.audit.findUniqueOrThrow({ where: { id: gap.auditId! } })).executionSpec))
        .toMatchObject({ monitoringPages: [origin + '/', peer] })
      await vi.waitFor(async () => expect(await prisma.auditVerifierExecution.findFirst({ where: { auditId: gap.auditId!, pageUrl: peer,
        workKind: 'browser', workState: { in: ['WAITING', 'READY'] } } })).not.toBeNull(), { timeout: 10_000, interval: 100 })
      const interrupted = await prisma.auditVerifierExecution.updateMany({ where: { auditId: gap.auditId!, pageUrl: peer,
        workKind: { in: ['browser', 'captures'] }, workState: { in: ['WAITING', 'READY'] } },
        data: { workRecoveryUntil: new Date(0) } })
      expect(interrupted.count).toBe(2)
      await dispatchReadyTasks(await reconcileTasks(gap.auditId!))
      expect(await prisma.auditVerifierExecution.count({ where: { auditId: gap.auditId!, pageUrl: peer,
        workKind: { in: ['browser', 'captures'] }, workState: 'EXHAUSTED', status: 'FAILED' } })).toBe(2)
      await getAuditTaskQueue('browser').resume()
      await complete(gap.auditId!)
      expect(await prisma.auditPage.findFirst({ where: { auditId: gap.auditId!, url: peer } })).toBeNull()
      const expectedCoverage = { pagesReached: 1, pagesExpected: 2, complete: false }
      expect((await loadSiteHome(siteId))?.presentation.coverage).toMatchObject(expectedCoverage)
      expect((await loadSiteSummaries(owner))[0]?.presentation.coverage).toMatchObject(expectedCoverage)
      expect(await getOwnedRun(owner, gap.runId!)).toMatchObject({ completionState: 'PARTIAL',
        coverage: { gaps: expect.arrayContaining([{ area: 'site', reason: 'pages' }]) } })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
      repaired = true; requests.length = 0
      const category = await requestSiteRun({ projectId: siteId, userId: owner, outcomeIds: [], source: 'WEB', scope: 'CATEGORY',
        categoryArea: 'search', idempotencyKey: 'category-gap-repair' })
      expect(readExecutionSpec((await prisma.audit.findUniqueOrThrow({ where: { id: category.auditId! } })).executionSpec))
        .toMatchObject({ category: { sourceAuditId: gap.auditId, pages: [origin + '/', peer] } })
      await complete(category.auditId!)
      const recorded = await prisma.auditVerifierExecution.findMany({ where: { auditId: category.auditId!, ...categoryCoverageExecutionSelect.where },
        select: categoryCoverageExecutionSelect.select })
      expect(recordedWorkComplete(recorded)).toBe(true)
      expect(recordedWorkComplete(recorded.filter(record => record.targetKey !== 'task:p0:http'))).toBe(false)
      expect(await getOwnedRun(owner, category.runId!)).toMatchObject({ scope: 'CATEGORY', area: 'search' })
      expect(requests).toContain('/pricing')
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: category.auditId })
      repaired = false; requests.length = 0
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const watch = await requestScheduledSiteRun({ projectId: siteId, userId: owner, interval: 'weekly', scheduledAt: tick, now: tick })
      await complete(watch.auditId!)
      expect(requests).toContain('/pricing')
      const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: 'title-missing', pageUrl: peer } })
      expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
    } finally { await getAuditTaskQueue('browser').resume(); linked = true; repaired = false }
  }, 180_000)

  it('verifies every original Performance page despite a successful representative-page proof and recognizes recurrence', async () => {
    linked = true; repaired = true; performance = 'failed'
    try {
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'performance-scope-source' })
      await complete(source.auditId!)
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'lcp-poor' } })
      expect(flag.affectedPaths).toEqual(expect.arrayContaining([origin + '/', peer]))
      representativePath = new URL(flag.pageUrl!).pathname
      const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      for (const phase of ['partial', 'missing-peer', 'healthy'] as const) {
        performance = phase
        const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId: flag.id,
          idempotencyKey: 'performance-scope-fix:' + phase, changeSummary: 'Improve loading on every original page' })
        const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId,
          flagId: flag.id, attemptId: fix.attemptId, idempotencyKey: 'performance-scope-verify:' + phase })
        if (!verification?.ok || !('verificationAuditId' in verification)) throw new Error('Fixture verification was not admitted')
        const auditId = verification.verificationAuditId!
        await complete(auditId)
        const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { verifierExecutions: true } })
        // This exact representative-page proof is successful in every phase.
        // It cannot replace missing or failed evidence from the original peer.
        const representative = audit.verifierExecutions.find(row => row.targetKey === 'check:lcp-poor')!
        expect(checkVerifierSchema.parse(representative.detail)).toMatchObject({ verdict: 'passed', pageUrl: flag.pageUrl })
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({
          outcome: phase === 'partial' ? 'UNCHANGED' : phase === 'missing-peer' ? 'INCONCLUSIVE' : 'IMPROVED',
          comparable: phase !== 'missing-peer', verificationAuditId: auditId })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({
          status: phase === 'healthy' ? 'FIXED' : 'OPEN', resolvedInId: phase === 'healthy' ? auditId : null })
        expect(hasRecordedRecoveryEvidence({ auditId, executionSpec: audit.executionSpec, flag, executions: audit.verifierExecutions }))
          .toBe(phase === 'healthy')
      }
      performance = 'failed'
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const recurring = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt: tick, now: tick })
      await complete(recurring.auditId!)
      const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'lcp-poor' } })
      expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: original.improvementId })
      const recurringAudit = await prisma.audit.findUniqueOrThrow({ where: { id: recurring.auditId! }, select: { parentId: true } })
      expect((await getFlagDiffSummary(recurringAudit.parentId, recurring.auditId!)).regressed.map(item => item.id)).toContain(recurrence.id)
    } finally { performance = null; representativePath = '/'; linked = true; repaired = false }
  }, 360_000)

  it('flags a retained page response independently of the entry URL and verifies uncertainty, repair and recurrence', async () => {
    linked = false; repaired = true; pageResponse = 'failed'
    try {
      // The page was previously discovered, but is no longer linked. Its raw
      // response must remain actionable even when rendered inspection cannot run.
      await prisma.audit.create({ data: { projectId, userId, url: origin + '/', status: 'COMPLETED', completedAt: new Date(),
        executionSpec: { version: 1, scope: 'SITE', targetUrl: origin + '/', environment: 'production',
          checks: {}, outcomes: [], verificationTarget: null },
        pages: { create: [origin + '/', peer].map((url, position) => ({ url, normalizedUrl: url, position,
          role: position ? 'linked' : 'primary', status: 'COMPLETED' })) } } })
      const source = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'page-response-source' })
      await complete(source.auditId!)
      const original = await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId! } })
      expect(readExecutionSpec(original.executionSpec)).toMatchObject({ monitoringPages: [origin + '/', peer] })
      const response = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: source.auditId!, pageUrl: peer, workKind: 'http' } })
      expect(response.workResult).toMatchObject({ data: { document: { url: peer, status: 503, complete: true } } })
      const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'page-http-error', pageUrl: peer } })
      expect(flag.evidence).toContain('503')
      expect(await prisma.flag.count({ where: { auditId: source.auditId!, checkId: 'page-http-error', pageUrl: origin + '/' } })).toBe(0)
      const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      for (const phase of ['failed', 'challenge', 'healthy'] as const) {
        pageResponse = phase
        const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId: flag.id,
          idempotencyKey: 'page-response-fix:' + phase, changeSummary: 'Restore the recorded page response' })
        const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId: flag.id,
          attemptId: fix.attemptId, idempotencyKey: 'page-response-verify:' + phase })
        if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Page response verification was not admitted')
        await complete(verification.verificationAuditId!)
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({
          outcome: phase === 'failed' ? 'UNCHANGED' : phase === 'challenge' ? 'INCONCLUSIVE' : 'IMPROVED', comparable: phase !== 'challenge' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: phase === 'healthy' ? 'FIXED' : 'OPEN' })
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: verification.verificationAuditId!, targetKey: { startsWith: 'task:' } } })
        expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'http'])
      }
      pageResponse = 'failed'
      const tick = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
      const recurring = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt: tick, now: tick })
      await complete(recurring.auditId!)
      const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId, pageUrl: peer } })
      expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
      expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: occurrence.improvementId })
    } finally { pageResponse = 'healthy'; linked = true; repaired = false }
  }, 360_000)
})
