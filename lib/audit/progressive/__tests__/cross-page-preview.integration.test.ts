import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { getAuditBrowser, getBrowserDiagnostics, closeBrowser } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'
import { checkVerifierSchema } from '@/lib/audit/checks/verification'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Cross-page preview worker verification', () => {
  const userId = 'preview-' + randomUUID(), projectId = 'preview-' + randomUUID()
  const origin = 'https://example.com', urls = ['/', '/pricing', '/features'].map(path => origin + path)
  let mode: 'failed' | 'partial' | 'missing' | 'healthy' | 'without-descriptions' = 'failed'
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml')
      response.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>'); return
    }
    if (mode === 'missing' && request.url === '/features') { response.writeHead(503); response.end('Unavailable'); return }
    const unique = mode === 'healthy' || mode === 'without-descriptions' || mode !== 'failed' && request.url === '/pricing'
    const title = unique ? 'Useful information ' + request.url : 'Shared preview title'
    const description = mode === 'without-descriptions' ? '' : unique ? 'Specific preview description for ' + request.url : 'The same long description used on every page.'
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>' + (mode === 'failed' ? 'Shared document title' : 'Page ' + request.url) + '</title><meta name="description" content="Useful service information.">' +
      '<meta property="og:title" content="' + title + '"><meta property="og:description" content="' + description + '"></head>' +
      '<body><main><h1>Useful service information</h1><p>Read about the service and its prices.</p><a href="/pricing">Prices</a><a href="/features">Features</a>' +
      (request.url === '/features' ? '<div hidden>' + 'x'.repeat(1_100_000) + '</div>' : '') + '</main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname)) throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('External service unavailable in this fixture')
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
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Preview fixture', canonicalHost: 'example.com', url: urls[0] } })
    // This seed establishes previously discovered URLs, without passing evidence.
    await prisma.audit.create({ data: { projectId, userId, url: urls[0], status: 'COMPLETED', completedAt: new Date(),
      executionSpec: { version: 1, scope: 'SITE', targetUrl: urls[0], environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: urls.map((url, position) => ({ url, normalizedUrl: url, role: position ? 'linked' : 'primary', position, status: 'COMPLETED' })) } } })
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const diagnostics = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: diagnostics.connected, activeBrowserContexts: diagnostics.activeContexts, queueState: 'idle' })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    for (const queue of [getAuditQueue(), ...(['http', 'browser', 'provider', 'evaluate', 'availability'] as const).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function complete(auditId: string) {
    await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
      .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 60_000, interval: 200 })
  }
  async function category(key: string) {
    const result = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'CATEGORY', categoryArea: 'search', idempotencyKey: key })
    await complete(result.auditId!); return result.auditId!
  }
  it('keeps original page comparisons through partial evidence, repair and same-incident recurrence', async () => {
    const before = await category('preview-failure')
    const largeBrowser = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: before, workKind: 'browser', pageUrl: urls[2] } })
    expect(largeBrowser.workResult).toMatchObject({ data: { metadata: null, preview: { version: 1, titleComplete: true, descriptionComplete: true },
      snapshot: { desktopHtml: null, desktopHtmlTruncated: true } } })
    const duplicate = await prisma.flag.findFirstOrThrow({ where: { auditId: before, checkId: 'search-duplicate-title' } })
    expect(duplicate.evidence).toContain('3 checked pages')
    const flags = await prisma.flag.findMany({ where: { auditId: before, checkId: { in: ['corridor-og-title-drift', 'corridor-og-description-drift'] } }, orderBy: { checkId: 'asc' } })
    expect(flags).toHaveLength(2)
    const flag = flags.find(item => item.checkId === 'corridor-og-title-drift')!
    expect(flag.affectedPaths).toEqual(expect.arrayContaining(urls))
    expect(flag.evidenceTargets).toHaveLength(2)
    for (const state of ['partial', 'missing', 'healthy'] as const) {
      mode = state
      const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'preview-fix-' + state,
        changeSummary: 'Give each original page a distinct preview title' })
      const result = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'preview-verification-' + state,
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: before } })
      await complete(result.auditId!)
      const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })
      expect(attempt.outcome).toBe(state === 'healthy' ? 'IMPROVED' : state === 'partial' ? 'UNCHANGED' : 'INCONCLUSIVE')
      const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: result.auditId!, targetKey: { startsWith: 'task:' } } })
      expect(tasks.map(task => task.workKind).sort()).toEqual(['browser', 'browser', 'browser', 'cross-page', 'finalize'])
      if (state === 'healthy') {
        const proof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: result.auditId!, targetKey: 'check:corridor-og-title-drift' } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'rendered-dom' })
        const receipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: result.auditId!, targetKey: 'module:corridor' } })
        expect(receipts.flatMap(receipt => checkReceiptSchema.parse(receipt.detail).assertions).filter(assertion => assertion.key === 'preview-titles')).toHaveLength(3)
      }
    }
    const description = flags.find(item => item.checkId === 'corridor-og-description-drift')!
    mode = 'without-descriptions'
    const removedFix = await recordSiteFlagFix({ siteId: projectId, flagId: description.id, userId, idempotencyKey: 'preview-removed-description-fix',
      changeSummary: 'Remove the duplicated preview descriptions' })
    const removedRun = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'preview-removed-description-verification',
      verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: description.pageUrl!, checkId: description.checkId!, attemptId: removedFix.attemptId, parentAuditId: before } })
    await complete(removedRun.auditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: removedFix.attemptId } }))
      .toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
    const removedReceipts = await prisma.auditVerifierExecution.findMany({ where: { auditId: removedRun.auditId!, targetKey: 'module:corridor' } })
    expect(removedReceipts.flatMap(receipt => checkReceiptSchema.parse(receipt.detail).assertions).filter(assertion => assertion.key === 'preview-descriptions'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ complete: true, disposition: 'observed', passed: false })]))
    mode = 'healthy'
    const descriptionFix = await recordSiteFlagFix({ siteId: projectId, flagId: description.id, userId, idempotencyKey: 'preview-description-fix',
      changeSummary: 'Give each original page a distinct preview description' })
    const descriptionRun = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'preview-description-verification',
      verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: description.pageUrl!, checkId: description.checkId!, attemptId: descriptionFix.attemptId, parentAuditId: before } })
    await complete(descriptionRun.auditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: descriptionFix.attemptId } })).toMatchObject({ outcome: 'IMPROVED' })
    const descriptionProof = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: descriptionRun.auditId!, targetKey: 'check:corridor-og-description-drift' } })
    expect(checkVerifierSchema.parse(descriptionProof.detail)).toMatchObject({ verdict: 'passed', assertion: { key: 'preview-descriptions' } })
    mode = 'failed'
    const recurring = await category('preview-recurrence')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    const source = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: source.improvementId })
    const recurringDescription = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring, checkId: description.checkId } })
    expect(recurringDescription).toMatchObject({ status: 'REGRESSED', fingerprint: description.fingerprint })
    const sourceDescription = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: description.id } })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurringDescription.id } })).toMatchObject({ improvementId: sourceDescription.improvementId })
    mode = 'healthy'
    const automatic = await category('preview-automatic-recovery')
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: automatic } })
    const summary = await getFlagDiffSummary(audit.parentId, automatic)
    expect(summary.fixed.map(item => item.checkId)).toEqual(expect.arrayContaining([flag.checkId, description.checkId]))
    for (const current of [recurrence, recurringDescription])
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: current.id } })).toMatchObject({ status: 'FIXED', resolvedInId: automatic })
  }, 240_000)
})
