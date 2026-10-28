import { recordFlagImprovementAttempt } from '@/lib/improvements/service'
import * as prescriptionSettlement from '../incomplete'
import { finalizeFromOutcome } from '@/lib/audit/pipeline/finalize-from-outcome'
import type { PageEvidence, PipelineContext } from '@/lib/audit/pipeline/types'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { assessTriageRecommendations } from '@/lib/audit/triage-grounding'
import { triageOutputSchema } from '@/lib/audit/judge-triage-schema'
import { flagKeyForRow } from '@/lib/audit/persist'
import { TASK_QUEUES } from '../queues'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { resolveAuditAccess } from '@/lib/audit/access'
import { claimAnonymousAudits } from '@/lib/audit/claim-anonymous'
import { ANON_AUDIT_IDS_COOKIE, readClaimedAnonymousIds } from '@/lib/audit/usage'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { dispatchReadyTasks, reconcileTasks, recoverProgressiveTasks } from '../engine'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { loadSiteFlags, loadSiteFlagDetail } from '@/lib/sites/flags'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { loadMonitoringHistory } from '@/lib/sites/application/monitoring-history'
import { processDueProjectWatches } from '@/lib/audit/project-watch'
import { requestScheduledSiteRun } from '@/lib/sites/application/scheduled-runs'
import { setProjectWatch } from '@/lib/sites/application/monitoring-settings'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { fixedClock, systemClock } from '@/lib/time/clock'
import { executeUptimeProbe, scheduleUptimeProbes } from '@/lib/uptime/service'
import { startUptimeWorker } from '@/lib/uptime/queue'
import { loadUptimeSummary } from '@/lib/uptime/queries'
import { enqueueAiReview, enqueuePendingAiReview, recoverPendingAiReviews } from '@/lib/audit/enqueue-ai-review'
import { executionWrite, withExecutionOwnership } from '@/lib/audit/execution-ownership'
import * as prescription from '@/lib/audit/judge-prescription'
import { prescriptionOutputSchema } from '@/lib/audit/judge-prescription-schema'
import { recordedPrescriptionFields } from '@/lib/audit/prescription-guidance-schema'
import { uploadScreenshot, deleteAuditScreenshotAssets } from '@/lib/storage/screenshots'
import { loadExecutionProgress } from '@/lib/sites/application/execution-progress'
import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { McpServer } from '@modelcontextprotocol/server'
import { registerSiteOutcomeTools } from '@/lib/mcp/tools/sites'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import type { SiteCheckResult } from '@/lib/sites/check-results'

const cookieState = vi.hoisted(() => ({ values: new Map<string, string>() }))
// Retain deterministic public DNS outside TEST-NET-3. The controlled transport
// below supplies responses; neither real DNS nor live websites supply this proof.
vi.mock('node:dns/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:dns/promises')>(),
  resolve4: async () => ['203.0.114.1'], resolve6: async () => [],
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieState.values.has(name) ? { value: cookieState.values.get(name) } : undefined,
    set: (name: string, value: string) => { cookieState.values.set(name, value) },
    delete: (name: string) => { cookieState.values.delete(name) },
  }),
  headers: async () => new Headers({ host: 'localhost:3000' }),
}))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('URL-first analysis through claim and monitored repair', () => {
  const owner = 'claimed-loop-' + randomUUID(), origin = 'https://example.com', pageUrl = origin + '/'
  const capturedAudits: string[] = []
  let repaired = false
  let ownerCreated = false
  let worker: ReturnType<typeof startWorker> | undefined
  let uptime: ReturnType<typeof startUptimeWorker> | undefined
  async function mcpCall(userId: string, name: string, args: Record<string, unknown>) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const toolServer = new McpServer({ name: 'claimed-loop', version: '1.0.0' }, { capabilities: { tools: {} } })
    const client = new Client({ name: 'claimed-loop-reader', version: '1.0.0' })
    registerSiteOutcomeTools(toolServer, user)
    try {
      await toolServer.connect(serverTransport)
      await client.connect(clientTransport)
      const result = await client.callTool({ name, arguments: args })
      const content = result.content as Array<{ type: string; text?: string }>
      expect(JSON.parse(content.find(item => item.type === 'text')?.text ?? '{}')).toEqual(result.structuredContent)
      const next = result.structuredContent?.next as { tool: string; arguments: Record<string, unknown> } | undefined
      if (next) {
        const tools = await client.listTools()
        const target = tools.tools.find(tool => tool.name === next.tool)!
        expect(target).toBeDefined()
        const properties = target.inputSchema.properties ?? {}
        expect(Object.keys(next.arguments).filter(key => !Object.hasOwn(properties, key))).toEqual([])
      }
      return result
    } finally { await client.close(); await toolServer.close() }
  }
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml')
      response.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + pageUrl + '</loc></url></urlset>'); return
    }
    for (const [key, value] of Object.entries({
      'content-security-policy': "default-src 'self'; script-src 'self'" + (repaired ? '' : " 'unsafe-inline'") + "; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'strict-transport-security': 'max-age=31536000; includeSubDomains; preload', 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin', 'cross-origin-opener-policy': 'same-origin', 'cross-origin-resource-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'x-permitted-cross-domain-policies': 'none',
    })) response.setHeader(key, value)
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>Useful service for your team</title>' +
      '<meta name="description" content="Read about our service and learn how it can help your team.">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="' + pageUrl + '"></head>' +
      '<body><main><section hidden><h1>Your Company Name</h1><p>Lorem ipsum retired template copy</p></section>' +
      '<h1>Useful service for your team</h1><p>Read how our service helps you manage your work.</p>' +
      '<a href="#details">Get started</a><section id="details"><h2>How the service works</h2><p>Review the information before choosing your next step.</p></section></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    vi.stubEnv('BETTER_AUTH_SECRET', 'local-claimed-monitoring-proof-at-least-32-characters')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('External provider unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    const original = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => original(browser, url, { ...options,
      configurePage: async page => {
        await options.configurePage?.(page)
        await page.route('**', async route => {
          const resource = new URL(route.request().url())
          if (resource.origin !== origin) { await route.abort('blockedbyclient'); return }
          const response = await nativeFetch(transport + resource.pathname + resource.search)
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
        })
      },
    }))
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    ownerCreated = true
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const diagnostics = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: diagnostics.connected, activeBrowserContexts: diagnostics.activeContexts, queueState: 'idle' })
    uptime = startUptimeWorker(executeUptimeProbe)
  })
  afterAll(async () => {
    await uptime?.close(); await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    await deleteAuditScreenshotAssets(capturedAudits)
    // Pending alerts from this completed fixture cannot enter a later suite's
    // bounded global retry sweep. The database guard above confines cleanup.
    if (ownerCreated) await prisma.user.deleteMany({ where: { id: owner } })
    for (const queue of [getAuditQueue(), ...(Object.keys(TASK_QUEUES) as Array<keyof typeof TASK_QUEUES>).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); await prisma.$disconnect()
  })
  async function complete(auditId: string, browserRequired = true) {
    capturedAudits.push(auditId)
    await vi.waitFor(async () => {
      // Provider acceptance is deliberately absent. Public collection, native
      // browser observations, evaluation and projection execute normally.
      await prisma.auditExecutionTask.updateMany({ where: { auditId, workState: { not: 'COMPLETED' }, workKind: { in: ['pagespeed', 'google', 'judge'] } },
        data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId, workKind: 'finalize' } }))
        .toMatchObject({ workState: 'COMPLETED' })
      if (browserRequired) expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId, workKind: 'browser' } }))
        .toMatchObject({ workState: 'COMPLETED', workResult: { data: { metadata: { renderedCopy: { complete: true } } } } })
    }, { timeout: 90_000, interval: 200 })
  }
  it('isolates unclaimed history and fences an ownership change during the read', async () => {
    const audits: string[] = [], sites: string[] = []
    try {
      for (const userId of [null, null, owner]) {
        const audit = await prisma.audit.create({ data: { url: pageUrl, userId, status: 'COMPLETED', completedAt: new Date(), isPublic: false } })
        audits.push(audit.id)
      }
      for (const primaryAuditId of audits.slice(0, 2)) {
        const site = await prisma.provisionalSite.create({ data: { sessionKey: randomUUID(), canonicalHost: new URL(pageUrl).hostname,
          url: pageUrl, primaryAuditId } })
        sites.push(site.id)
      }
      const provisional = (await loadSiteRecord('p_' + sites[0]))!
      const history = await loadMonitoringHistory(provisional)
      expect(history.timeline.map(entry => entry.id)).toEqual([audits[0]])
      expect(history.trend.map(entry => entry.id)).toEqual([audits[0]])
      await prisma.audit.update({ where: { id: audits[0] }, data: { userId: owner } })
      expect(await loadMonitoringHistory(provisional)).toEqual({ timeline: [], trend: [] })
    } finally {
      await prisma.provisionalSite.deleteMany({ where: { id: { in: sites } } })
      await prisma.audit.deleteMany({ where: { id: { in: audits } } })
    }
  })
  it('keeps the original Site and evidence through signed claim, default uptime, independent repair and scheduled recurrence', async () => {
    const anonymous = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: pageUrl,
    visitorKey: 'claimed-loop-' + randomUUID() })
    expect(anonymous.siteId).toMatch(/^p_/)
    expect(await readClaimedAnonymousIds()).toEqual([anonymous.auditId])
    await complete(anonymous.auditId)
    expect(await prisma.flag.count({ where: { auditId: anonymous.auditId, checkId: 'journey-hidden-cta' } })).toBe(0)
    const source = await prisma.audit.findUniqueOrThrow({ where: { id: anonymous.auditId }, include: { pages: true } })
    expect(await prisma.flag.count({ where: { auditId: source.id, checkId: { in: ['placeholder-copy-detected', 'template-default-copy'] } } })).toBe(0)
    expect(source.htmlMetadata).toMatchObject({ pageText: expect.stringContaining('Lorem ipsum'),
      renderedCopy: { pageText: expect.not.stringContaining('Lorem ipsum'), h1s: ['Useful service for your team'], complete: true } })
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.id, checkId: 'security-csp-unsafe-inline' } })
    expect(source).toMatchObject({ userId: null, projectId: null, isPublic: false })
    const provisional = (await loadSiteRecord(anonymous.siteId!))!
    const creatorHistory = await loadMonitoringHistory(provisional)
    expect(creatorHistory.timeline.map(entry => entry.id)).toEqual([source.id])
    expect(creatorHistory.trend.map(entry => entry.id)).toEqual([source.id])
    expect(creatorHistory.timeline[0].flags).toEqual(expect.arrayContaining([{ id: flag.id, title: flag.problem }]))
    expect(await resolveAuditAccess(source, null, undefined, await readClaimedAnonymousIds())).toBe('anonymous_teaser')
    expect(await resolveAuditAccess(source, null)).toBe('denied')
    expect(await resolveAuditAccess(source, { id: owner })).toBe('denied')
    expect(await claimAnonymousAudits(owner)).toBe(1)
    expect(source.triageAt).toBeNull()
    expect(await getAuditQueue().getJob('ai-review-' + source.id)).toBeUndefined()
    expect(cookieState.values.has(ANON_AUDIT_IDS_COOKIE)).toBe(false)
    const site = (await loadSiteRecord(anonymous.siteId!))!
    expect(site).toMatchObject({ kind: 'project', userId: owner, primaryAuditId: source.id, watchInterval: 'weekly' })
    expect(site.projectId).toBeTruthy()
    const claimed = await prisma.audit.findUniqueOrThrow({ where: { id: source.id }, include: { pages: true } })
    expect(await resolveAuditAccess(claimed, { id: owner })).toBe('owner')
    expect(await resolveAuditAccess(claimed, null, undefined, [source.id])).toBe('denied')
    expect(claimed).toMatchObject({ userId: owner, projectId: site.projectId, completedAt: source.completedAt, includeAi: true, triageAt: null, aiReviewAt: null,
      pages: source.pages.map(page => expect.objectContaining({ id: page.id, url: page.url, normalizedUrl: page.normalizedUrl, htmlMetadata: page.htmlMetadata })) })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toEqual(flag)
    expect((await loadSiteHome(site.siteId, { ownerEvidence: true }))?.flags).toEqual(expect.arrayContaining([expect.objectContaining({ sourceFlagId: flag.id })]))
    const mcpFlag = await mcpCall(owner, MCP_TOOLS.getFlag.name, { siteId: site.siteId, flagId: flag.id })
    expect(mcpFlag.isError).not.toBe(true)
    expect(mcpFlag.structuredContent).toMatchObject({ siteId: site.siteId, flag: { sourceFlagId: flag.id, checkId: flag.checkId, status: 'OPEN' } })
    let resultCursor: string | undefined, foundSourceFinding = false
    for (let page = 0; page < 20; page++) {
      const mcpOutcomes = await mcpCall(owner, MCP_TOOLS.listOutcomes.name, { siteId: site.siteId, ...(resultCursor ? { resultCursor } : {}) })
      expect(mcpOutcomes.isError).not.toBe(true)
      const apiPage = await loadSiteCheckResultPage(site, source.id, resultCursor)
      expect(mcpOutcomes.structuredContent).toMatchObject({ siteId: site.siteId, checkResults: apiPage.results, checkResultsNextCursor: apiPage.nextCursor })
      foundSourceFinding ||= (mcpOutcomes.structuredContent!.checkResults as SiteCheckResult[]).some(result =>
        result.auditId === source.id && result.status === 'findings' && result.source === 'http')
      if (foundSourceFinding || !apiPage.nextCursor) break
      expect(apiPage.nextCursor).not.toBe(resultCursor)
      resultCursor = apiPage.nextCursor
    }
    expect(foundSourceFinding).toBe(true)
    const availability = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId: site.projectId!, kind: 'AVAILABILITY' }, include: { bindings: true } })
    expect((await loadExecutionProgress(site, source.id))?.total).toBeGreaterThan(0)
    expect(availability.bindings).toMatchObject([{ mechanism: 'HTTP_AVAILABILITY' }])
    await scheduleUptimeProbes(systemClock, 1, site.projectId!)
    await vi.waitFor(async () => expect(await loadUptimeSummary(site.projectId!)).toMatchObject({ enabled: true, state: 'online' }), { timeout: 10_000, interval: 100 })
    const monitor = await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId: site.projectId! } })
    repaired = true
    const fixed = await recordSiteFlagFix({ siteId: site.siteId, userId: owner, flagId: flag.id,
      idempotencyKey: 'claimed-header-fix', changeSummary: 'Remove unsafe-inline from the script policy' })
    const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.siteId, userId: owner, flagId: flag.id,
      attemptId: fixed.attemptId, idempotencyKey: 'claimed-header-verify' })
    if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Claimed repair was not admitted')
    await complete(verification.verificationAuditId!, false)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true, sourceAuditId: source.id })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verification.verificationAuditId })
    expect(await getOwnedRun(owner, verification.runId!)).toMatchObject({ result: 'CLEAR', scope: 'DIAGNOSTIC' })
    const mcpRun = await mcpCall(owner, MCP_TOOLS.getRun.name, { runId: verification.runId })
    expect(mcpRun.isError).not.toBe(true)
    expect(mcpRun.structuredContent).toMatchObject({ id: verification.runId, result: 'CLEAR', scope: 'DIAGNOSTIC' })
    expect((await mcpCall(owner, MCP_TOOLS.getFlag.name, { siteId: site.siteId, flagId: flag.id })).structuredContent)
      .toMatchObject({ flag: { sourceFlagId: flag.id, verificationState: 'verified' } })
    expect((await loadMonitoringHistory(site)).timeline.find(entry => entry.id === source.id)?.flags).toEqual(expect.arrayContaining([{ id: flag.id, title: flag.problem }]))
    repaired = false
    const tick = new Date()
    // Make broad evidence due without moving only the scheduler's lease clock.
    await prisma.audit.update({ where: { id: source.id }, data: { createdAt: new Date(tick.getTime() - 8 * 86400_000) } })
    await prisma.project.update({ where: { id: site.projectId! }, data: { watchNextRunAt: tick } })
    expect(await processDueProjectWatches(1, { onlyProjectId: site.projectId!, clock: fixedClock(tick) })).toMatchObject({ enqueued: 1, errors: 0 })
    const watch = await prisma.runRequest.findFirstOrThrow({ where: { projectId: site.projectId!, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } })
    await complete(watch.auditId!)
    const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: watch.auditId!, checkId: flag.checkId } })
    expect(repeated).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    const original = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: repeated.id } })).toMatchObject({ improvementId: original.improvementId })
    expect(await loadSiteFlags(site)).toEqual(expect.arrayContaining([expect.objectContaining({ sourceFlagId: repeated.id, verificationState: 'regressed' })]))
    expect((await mcpCall(owner, MCP_TOOLS.getFlag.name, { siteId: site.siteId, flagId: repeated.id })).structuredContent)
      .toMatchObject({ flag: { sourceFlagId: repeated.id, verificationState: 'regressed' } })
    const stranger = await prisma.user.create({ data: { email: 'stranger-' + randomUUID() + '@example.test' } })
    try {
      expect((await mcpCall(stranger.id, MCP_TOOLS.getFlag.name, { siteId: site.siteId, flagId: repeated.id })).isError).toBe(true)
      expect((await mcpCall(stranger.id, MCP_TOOLS.getRun.name, { runId: verification.runId })).isError).toBe(true)
    } finally { await prisma.user.delete({ where: { id: stranger.id } }) }
    repaired = true
    const fixInput = { siteId: site.siteId, flagId: repeated.id, idempotencyKey: 'claimed-mcp-fix', changeSummary: 'Restore the original script policy' }
    const mcpFix = await mcpCall(owner, MCP_TOOLS.recordFix.name, fixInput)
    expect(mcpFix.isError).not.toBe(true)
    const attemptId = mcpFix.structuredContent!.attemptId as string
    const verifyNext = mcpFix.structuredContent!.next as { tool: string; arguments: Record<string, unknown> }
    expect(verifyNext).toMatchObject({ tool: MCP_TOOLS.verifyFlag.name, arguments: { attemptId } })
    const mcpVerification = await mcpCall(owner, verifyNext.tool, verifyNext.arguments)
    expect(mcpVerification.isError).not.toBe(true)
    expect(mcpVerification.structuredContent).toMatchObject({ status: 'ACCEPTED', auditId: expect.any(String), runId: expect.any(String) })
    const replay = await mcpCall(owner, MCP_TOOLS.recordFix.name, fixInput)
    expect(replay.isError).not.toBe(true)
    expect(replay.structuredContent).toMatchObject({ attemptId, next: { tool: MCP_TOOLS.getRun.name } })
    const runNext = replay.structuredContent!.next as { tool: string; arguments: Record<string, unknown> }
    await complete(mcpVerification.structuredContent!.auditId as string, false)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    expect((await mcpCall(owner, runNext.tool, runNext.arguments)).structuredContent)
      .toMatchObject({ result: 'CLEAR', scope: 'DIAGNOSTIC', source: 'MCP' })
    expect((await mcpCall(owner, MCP_TOOLS.getFlag.name, { siteId: site.siteId, flagId: repeated.id })).structuredContent)
      .toMatchObject({ flag: { sourceFlagId: repeated.id, verificationState: 'verified' } })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verification.verificationAuditId })
    expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId: site.projectId! } })).toMatchObject({ id: monitor.id, version: monitor.version })

    // Reconciliation retains its admitted operator instead of impersonating the owner.
    const actorId = 'watch-operator-' + randomUUID(), sessionId = randomUUID()
    await prisma.user.create({ data: { id: actorId, email: actorId + '@example.test', role: 'admin' } })
    await prisma.session.create({ data: { id: sessionId, userId: actorId, token: randomUUID(), expiresAt: new Date(Date.now() + 300_000) } })
    const operation = await prisma.adminOperation.create({ data: { actorId, actorSessionId: sessionId, actorAuthenticatedAt: new Date(),
      action: 'SITE_RECONCILE', targetType: 'SITE', targetId: site.projectId!, ownerId: owner, reason: 'Controlled local reconciliation',
      input: {}, expectedRevision: 'fixture', idempotencyKey: randomUUID(), requestHash: 'fixture', intentExpiresAt: new Date(Date.now() + 300_000),
      status: 'RUNNING', executionToken: randomUUID(), leaseUntil: new Date(Date.now() + 300_000) } })
    const operator = { kind: 'admin' as const, actorId, operationId: operation.id }
    const operatorTick = new Date()
    try {
      await prisma.project.update({ where: { id: site.projectId! }, data: { watchNextRunAt: operatorTick } })
      expect(await processDueProjectWatches(1, { onlyProjectId: site.projectId!, clock: fixedClock(operatorTick), operator }))
        .toMatchObject({ enqueued: 1, errors: 0 })
      const receipt = await prisma.runRequest.findFirstOrThrow({ where: { projectId: site.projectId!, source: 'WATCH', requestedByUserId: actorId } })
      expect(receipt.context).toMatchObject({ adminOperationId: operation.id, cadence: 'weekly' })
      await complete(receipt.auditId!, false)
      const replay = { projectId: site.projectId!, userId: owner, interval: 'weekly' as const, scheduledAt: operatorTick, now: operatorTick, operator }
      expect(await requestScheduledSiteRun(replay)).toMatchObject({ runId: receipt.id, reused: true })
      await prisma.session.delete({ where: { id: sessionId } })
      await expect(requestScheduledSiteRun(replay)).rejects.toMatchObject({ code: 'ADMIN_ACCESS_REVOKED' })
      const before = await prisma.project.findUniqueOrThrow({ where: { id: site.projectId! } })
      await expect(processDueProjectWatches(1, { onlyProjectId: site.projectId!, operator })).rejects.toMatchObject({ code: 'ADMIN_ACCESS_REVOKED' })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: site.projectId! } })).toMatchObject({
        watchNextRunAt: before.watchNextRunAt, watchLastAttemptAt: before.watchLastAttemptAt, watchLeaseUntil: before.watchLeaseUntil })
      expect(await prisma.runRequest.count({ where: { projectId: site.projectId!, source: 'WATCH', requestedByUserId: actorId } })).toBe(1)
    } finally {
      await prisma.adminOperation.delete({ where: { id: operation.id } })
      await prisma.user.delete({ where: { id: actorId } })
    }
    const retainedAssessments = await prisma.outcomeAssessment.findMany({ where: { outcomeId: availability.id }, orderBy: { id: 'asc' } })
    for (const interval of ['hourly', 'weekly'] as const) {
      const changedAt = new Date()
      expect(await setProjectWatch({ projectId: site.projectId!, userId: owner, interval }, { clock: fixedClock(changedAt) }))
        .toMatchObject({ ok: true })
      expect(await processDueProjectWatches(1, { onlyProjectId: site.projectId!, clock: fixedClock(changedAt) }))
        .toMatchObject({ enqueued: 1, errors: 0 })
      const scheduled = await prisma.runRequest.findFirstOrThrow({ where: { projectId: site.projectId!, source: 'WATCH',
        requestedAt: { gte: changedAt } }, orderBy: { requestedAt: 'desc' } })
      expect(readExecutionSpec(scheduled.executionSpec)).toMatchObject({ scope: 'OUTCOMES' })
      await complete(scheduled.auditId!, false)
      const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: {
        runRequestId_outcomeId: { runRequestId: scheduled.id, outcomeId: availability.id },
      } })
      expect(assessment.state).toBe('CLEAR')
      expect(assessment.validUntil.getTime() - assessment.assessedAt.getTime())
        .toBe((interval === 'hourly' ? 13 * 60 : 8 * 24 * 60) * 60_000)
      expect((await loadSiteHome(site.siteId))?.outcomes.find(outcome => outcome.id === availability.id))
        .toMatchObject({ state: 'CLEAR', latestRunId: scheduled.id, validUntil: assessment.validUntil.toISOString() })
    }
    expect(await prisma.outcomeAssessment.findMany({ where: { id: { in: retainedAssessments.map(assessment => assessment.id) } },
      orderBy: { id: 'asc' } })).toEqual(retainedAssessments)
  }, 240_000)

  it.each(['missing-linked-page', 'rejected-advisory', 'missing-primary-metadata', 'missing-primary-capture', 'interrupted-after-guidance', 'incomplete-prescriptions'] as const)(
    'settles committed partial triage and its independent prescription obligation: %s', async condition => {
      // Controlled triage/provider fixtures exercise real persistence, finalization,
      // private storage and the durable worker. They do not prove live AI quality.
      const project = await prisma.project.upsert({ where: { userId_canonicalHost: { userId: owner, canonicalHost: 'example.com' } },
        create: { userId: owner, canonicalHost: 'example.com', url: origin, name: 'Partial triage lifecycle' }, update: {} })
      const primaryMissing = condition === 'missing-primary-metadata', captureMissing = condition === 'missing-primary-capture'
      const incompletePrescriptions = condition === 'incomplete-prescriptions'
      const failedPrescriptions = primaryMissing || captureMissing || incompletePrescriptions
      const interrupted = condition === 'interrupted-after-guidance'
      const completion = interrupted ? vi.spyOn(prescriptionSettlement, 'settlePrescriptionAudit').mockRejectedValueOnce(new Error('Controlled interruption after guidance commit')) : null
      const linkedUrl = origin + '/linked', reviewUrl = primaryMissing ? linkedUrl : pageUrl
      const metadata = parseMetadataFromHtml('<title>Plan releases together. Coordinate your team.</title><h1>Release planning for teams</h1>', reviewUrl)
      metadata.renderedCopy = { version: 1, pageUrl: reviewUrl, complete: true, textTruncated: false,
        pageText: 'Release planning for teams', h1s: ['Release planning for teams'], h2s: [] }
      const candidate = { reviewKind: 'search-snippet' as const, rubric: 'REACH' as const, device: 'none' as const,
        impactTag: 'SEO' as const, severity: 'POLISH' as const, confidence: 0.5, problem: 'Review title',
        evidence: 'Plan releases together.', whyItMatters: 'Review the wording in context.', pageUrl: reviewUrl,
        evidenceRefs: [{ source: 'title' as const, quote: 'Plan releases together.' }] }
      const grounded = assessTriageRecommendations([candidate,
        ...(condition === 'rejected-advisory' ? [{ ...candidate, evidenceRefs: [{ source: 'title' as const, quote: 'An invented reference' }] }] : [])],
        { url: reviewUrl, metadata, pageText: metadata.pageText })
      const output = triageOutputSchema.parse({ pageJob: 'Explain release planning', pageType: 'homepage', verdict: 'Controlled review',
        score: 75, launchReadiness: 'fix_first', launchChecklist: [],
        rubrics: ['MESSAGE', 'EXPERIENCE', 'REACH'].map(name => ({ name, score: 75, grade: 'C', status: 'NEEDS_WORK',
          assessmentState: 'ASSESSED', confidence: 0.5, summary: 'Controlled observed scope.' })), newFlags: grounded.admitted })
      const audit = await prisma.audit.create({ data: { userId: owner, projectId: project.id, url: pageUrl, status: 'FINALIZING',
        startedAt: new Date(), includeAi: true, skipUsageCount: true,
        htmlMetadata: primaryMissing ? Prisma.DbNull : metadata as unknown as Prisma.InputJsonValue,
        executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl,
          environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
        pages: { create: [pageUrl, linkedUrl].map((url, position) => ({ url, normalizedUrl: url,
          position, role: position ? 'linked' : 'primary', status: 'COMPLETED' })) } }, include: { pages: { orderBy: { position: 'asc' } } } })
      capturedAudits.push(audit.id)
      const review: PageEvidence = { pageId: audit.pages[primaryMissing ? 1 : 0]!.id, url: reviewUrl, metadata,
        desktop: null, mobile: null, desktopScreenshot: true, mobileScreenshot: false, desktopBase64: '', mobileBase64: null,
        flowScan: false, flags: [], failedModules: [], detectedTech: [], industryGuess: null,
        triage: { output, assessment: grounded.assessment, usage: { inputTokens: 1, outputTokens: 1, model: 'controlled-triage' } } }
      const absent: PageEvidence = { ...review, pageId: audit.pages[primaryMissing ? 0 : 1]!.id, url: primaryMissing ? pageUrl : linkedUrl,
        metadata: null, desktopScreenshot: false, triage: undefined, failedModules: ['metadata'] }
      const pages = condition === 'rejected-advisory' ? [review] : primaryMissing ? [absent, review] : [review, absent]
      let expectedKeys: string[] = []
      const provider = vi.spyOn(prescription, 'runPrescriptionWithRetry').mockImplementation(async input => {
        const keys = [...new Set(input.existingFlags.map(flag => flag.flagKey))]
        expect(keys).toEqual(expectedKeys)
        expect(input.existingFlags.every(flag => flag.attention === 'recommendation')).toBe(true)
        const parsed = prescriptionOutputSchema.parse({ flagPrescriptions: (incompletePrescriptions ? [] : keys).map(flagKey => ({ flagKey,
          ...recordedPrescriptionFields(input.existingFlags.find(flag => flag.flagKey === flagKey)!),
          fix: '1. Review the recorded title against the page purpose before suggesting any change.',
          agentPrompt: null, cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null })),
          rubricPrescriptions: input.rubrics.map(rubric => ({ name: rubric.name, rubricPrompt: 'Review the recorded scope.',
            cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null })) })
        return { output: prescription.validatePrescriptionOutput(parsed, input.existingFlags),
          usage: { inputTokens: 1, outputTokens: 1, model: 'controlled-prescription' } }
      })
      try {
        const capturedPage = primaryMissing || captureMissing ? audit.pages[1]! : audit.pages[0]!
        const key = 'capture-p' + capturedPage.position + '-g1'
        const url = await uploadScreenshot(audit.id, 'desktop', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a56sAAAAASUVORK5CYII=', 'base64'), key)
        await prisma.screenshot.create({ data: { auditId: audit.id, pageId: capturedPage.id, device: 'DESKTOP', url, width: 1, height: 1 } })
        const startedAt = new Date(), ctx: PipelineContext = { auditId: audit.id, deadline: Date.now() + 30_000,
          startedAt, clock: systemClock, includeAi: true, pagespeedCalls: 0, usage: { inputTokens: 1, outputTokens: 1, models: ['controlled-triage'] },
          trace: { executionId: audit.id, traceId: audit.id, attempt: 1 }, events: { log: async () => {} } }
        await finalizeFromOutcome({ ctx, auditId: audit.id, auditUrl: pageUrl, pageRuns: pages, startedAt, captureAdditionalEvidence: false })
        const committed = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
        expect(committed).toMatchObject({ status: 'COMPLETED', triageAt: expect.any(Date), aiReviewAt: null, reportCompleteness: 'PARTIAL' })
        expect(committed.evidenceCoverage).toMatchObject({ aiAssessment: false })
        const findings = await prisma.flag.findMany({ where: { auditId: audit.id }, orderBy: { position: 'asc' } })
        expect(findings).toHaveLength(1)
        expectedKeys = [...new Set(findings.map(flagKeyForRow))]
        await enqueuePendingAiReview(audit.id)
        if (interrupted) {
          await vi.waitFor(async () => expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'prescription' } }))
            .toMatchObject({ workState: 'RETRY_WAIT', workAttempts: 1 }), { timeout: 10_000, interval: 50 })
          expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'COMPLETED',
            aiReviewAt: null, completedAt: committed.completedAt, reportCompleteness: 'PARTIAL', evidenceCoverage: committed.evidenceCoverage })
          expect((await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id } })).fix.length).toBeGreaterThan(0)
          completion!.mockRestore()
          await prisma.auditExecutionTask.updateMany({ where: { auditId: audit.id, workKind: 'prescription' }, data: { workRetryAt: new Date(0) } })
          await prisma.audit.update({ where: { id: audit.id }, data: { dispatchNextAt: new Date(0) } })
          await recoverProgressiveTasks()
        }
        await vi.waitFor(async () => {
          const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'prescription' } })
          expect(task).toMatchObject(primaryMissing ? { workState: 'BLOCKED', workErrorCode: 'PRESCRIPTION_PRIMARY_METADATA_MISSING' }
            : captureMissing ? { workState: 'RETRY_WAIT', workErrorCode: 'PRESCRIPTION_PRIMARY_CAPTURE_MISSING' }
            : incompletePrescriptions ? { workState: 'BLOCKED', workErrorCode: 'AI_CONTRACT_INVALID' } : { workState: 'COMPLETED' })
        }, { timeout: 15_000, interval: 50 })
        if (captureMissing) {
          expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ failureCode: null, aiReviewAt: null })
          const pending = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'prescription' } })
          // Expire this disposable fixture's recovery window, never production time.
          await prisma.auditExecutionTask.update({ where: { id: pending.id }, data: { workRecoveryUntil: new Date(0) } })
          await reconcileTasks(audit.id)
          expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: pending.id } }))
            .toMatchObject({ workState: 'EXHAUSTED', workErrorCode: 'RECOVERY_EXHAUSTED' })
        }
        const settled = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
        expect(settled).toMatchObject({ status: 'COMPLETED', reportCompleteness: committed.reportCompleteness,
          evidenceCoverage: committed.evidenceCoverage, failedModules: committed.failedModules, triageAt: committed.triageAt,
          completedAt: committed.completedAt, verdict: committed.verdict, score: committed.score,
          aiReviewAt: failedPrescriptions ? null : expect.any(Date),
          failureCode: incompletePrescriptions ? 'AI_CONTRACT_INVALID' : failedPrescriptions ? 'AI_REVIEW_FAILED' : null })
        if (primaryMissing || captureMissing) expect(settled.failureMetadata).toMatchObject({ version: 1, phase: 'prescription',
          reason: primaryMissing ? 'PRESCRIPTION_PRIMARY_METADATA_MISSING' : 'RECOVERY_EXHAUSTED' })
        const after = await prisma.flag.findMany({ where: { auditId: audit.id }, orderBy: { position: 'asc' } })
        for (let index = 0; index < findings.length; index++) {
          expect(after[index]).toMatchObject({ id: findings[index]!.id, evidence: findings[index]!.evidence,
            supportingObservations: findings[index]!.supportingObservations, verificationRule: findings[index]!.verificationRule })
          expect(after[index]!.fix.length > 0).toBe(!failedPrescriptions)
        }
        expect(provider).toHaveBeenCalledTimes(primaryMissing || captureMissing ? 0 : 1)
        if (interrupted) expect(await prisma.auditPipelineEvent.count({ where: { auditId: audit.id, event: 'prescription_guidance_committed' } })).toBe(1)
        const site = (await loadSiteRecord(project.id))!
        expect(await loadSiteFlagDetail(site, findings[0]!.id)).toMatchObject({ repairGuidance: failedPrescriptions ? 'unavailable' : 'ready' })
        if (failedPrescriptions) {
          const before = { improvements: await prisma.improvement.count({ where: { projectId: project.id } }),
            events: await prisma.improvementCycleEvent.count({ where: { cycle: { projectId: project.id } } }),
            attempts: await prisma.improvementAttempt.count({ where: { improvement: { projectId: project.id } } }) }
          await expect(recordFlagImprovementAttempt({ flagId: findings[0]!.id, userId: owner, builder: 'copy', action: 'HANDOFF_COPIED' }))
            .rejects.toThrow('Repair guidance is unavailable')
          expect({ improvements: await prisma.improvement.count({ where: { projectId: project.id } }),
            events: await prisma.improvementCycleEvent.count({ where: { cycle: { projectId: project.id } } }),
            attempts: await prisma.improvementAttempt.count({ where: { improvement: { projectId: project.id } } }) }).toEqual(before)
        }

      } finally {
        completion?.mockRestore()
        provider.mockRestore()
        await prisma.audit.delete({ where: { id: audit.id } })
      }
    }, 30_000)

  it('keeps completed triage available during optional prescription, provider failure and queue retry', async () => {
    const project = await prisma.project.upsert({ where: { userId_canonicalHost: { userId: owner, canonicalHost: 'example.com' } },
      create: { userId: owner, canonicalHost: 'example.com', url: origin, name: 'Prescription lifecycle fixture' }, update: {} })
    const completedAt = new Date(Date.now() - 8 * 86400_000), projectedAt = new Date(completedAt.getTime() - 1)
    // This fixture supplies a recorded triage and controlled prescription
    // provider. It proves lifecycle isolation, never actual AI acceptance.
    const audit = await prisma.audit.create({ data: { userId: owner, projectId: project.id, url: pageUrl,
      status: 'JUDGING', progress: 70, startedAt: completedAt, completedAt, triageAt: completedAt,
      recoveryUntil: new Date(0), executionToken: 'expired-prescription-owner', executionGeneration: 1, executionLeaseUntil: new Date(0),
      improvementProjectedAt: projectedAt, includeAi: true, skipUsageCount: true,
      verdict: 'Recorded triage fixture', score: 72, htmlMetadata: { title: 'Recorded public page' },
      evidenceCoverage: { metadata: true, aiAssessment: true },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl,
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const provider = vi.spyOn(prescription, 'runPrescriptionWithRetry').mockImplementationOnce(async () => {
      await held; throw new Error('Controlled unavailable prescription provider')
    }).mockResolvedValue({ output: prescription.validatePrescriptionOutput(prescriptionOutputSchema.parse({ flagPrescriptions: [],
      rubricPrescriptions: ['MESSAGE', 'EXPERIENCE', 'REACH'].map(name => ({ name, rubricPrompt: 'Use the recorded evidence for this lifecycle fixture.',
        cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null })) }), []),
      usage: { inputTokens: 1, outputTokens: 1, model: 'local-lifecycle-fixture' } })
    try {
      const url = await uploadScreenshot(audit.id, 'desktop', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a56sAAAAASUVORK5CYII=', 'base64'))
      await prisma.screenshot.create({ data: { auditId: audit.id, device: 'DESKTOP', url, width: 1, height: 1 } })
      await getAuditTaskQueue('provider').pause()
      expect(await recoverPendingAiReviews()).toBe(1)
      await Promise.all(Array.from({ length: 8 }, () => enqueuePendingAiReview(audit.id)))
      const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'prescription' } })
      expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, workKind: 'prescription' } })).toBe(1)
      await (await getAuditTaskQueue('provider').getJob(task.id + '-g1'))!.remove()
      await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
      await prisma.audit.update({ where: { id: audit.id }, data: { dispatchNextAt: new Date(0) } })
      expect(await recoverProgressiveTasks()).toBeGreaterThan(0)
      expect(await getAuditTaskQueue('provider').getJob(task.id + '-g1')).toBeDefined()
      await getAuditTaskQueue('provider').resume()
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1), { timeout: 10_000, interval: 25 })
      expect(provider.mock.calls[0][3]).toBeGreaterThan(0)
      expect(provider.mock.calls[0][3]).toBeLessThanOrEqual(85_000)
      const preserved = { status: 'COMPLETED', progress: 100, completedAt, triageAt: completedAt,
        improvementProjectedAt: projectedAt, verdict: audit.verdict, score: audit.score, aiReviewAt: null }
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject(preserved)
      const site = (await loadSiteRecord(project.id))!
      expect(await loadExecutionProgress(site, audit.id)).toBeNull()
      await expect(withExecutionOwnership({ auditId: audit.id, token: 'expired-prescription-owner', generation: 1 },
        () => executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { verdict: 'Stale writer' } }))))
        .rejects.toThrow('no longer owns')
      release()
      await vi.waitFor(async () => {
        expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'RETRY_WAIT', workAttempts: 1 })
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } }))
          .toMatchObject({ ...preserved, failureCode: null })
        expect(await loadExecutionProgress(site, audit.id)).toBeNull()
      }, { timeout: 10_000, interval: 25 })
      await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
      await prisma.audit.update({ where: { id: audit.id }, data: { dispatchNextAt: new Date(0) } })
      expect(await recoverProgressiveTasks()).toBeGreaterThan(0)
      await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } }))
        .toMatchObject({ ...preserved, aiReviewAt: expect.any(Date), failureCode: null, errorMsg: null }), { timeout: 10_000, interval: 25 })
      expect(provider).toHaveBeenCalledTimes(2)
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 2 }), { timeout: 5000, interval: 25 })
      expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, workKind: { not: null } } })).toBe(1)
      const enriched = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
      // Reproduce interruption after enrichment commits but before task ack.
      await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workState: 'RUNNING', status: 'RUNNING',
        workToken: 'lost-ack-owner', workLeaseUntil: new Date(0), workResult: Prisma.DbNull } })
      await reconcileTasks(audit.id)
      await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
      await prisma.audit.update({ where: { id: audit.id }, data: { dispatchNextAt: new Date(0) } })
      expect(await recoverProgressiveTasks()).toBeGreaterThan(0)
      await vi.waitFor(async () => expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 3 }), { timeout: 5000, interval: 25 })
      expect(provider).toHaveBeenCalledTimes(2)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ aiReviewAt: enriched.aiReviewAt, completedAt })
    } finally { release(); provider.mockRestore(); await getAuditTaskQueue('provider').resume(); await deleteAuditScreenshotAssets([audit.id]) }
  }, 40_000)

  it('withholds ineligible prescription work and retains an authorized delay in the durable task', async () => {
    const ready = { userId: owner, status: 'COMPLETED' as const, includeAi: true, triageAt: new Date(), completedAt: new Date(), url: pageUrl }
    for (const changes of [{ status: 'CHECKING' as const }, { status: 'FAILED' as const }, { triageAt: null }, { completedAt: null },
      { userId: null }, { includeAi: false }, { aiReviewAt: new Date() }]) {
      const audit = await prisma.audit.create({ data: { ...ready, ...changes } })
      await enqueuePendingAiReview(audit.id)
      expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, workKind: 'prescription' } })).toBe(0)
    }
    const audit = await prisma.audit.create({ data: { ...ready, includeAi: false } })
    const before = Date.now()
    await enqueueAiReview(audit.id, 5000)
    const task = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'prescription' } })
    expect(task.workRetryAt!.getTime()).toBeGreaterThanOrEqual(before + 5000)
    expect(await getAuditTaskQueue('provider').getJob(task.id + '-g1')).toBeUndefined()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ includeAi: true })
  })
})
