import { TASK_QUEUES } from '../queues'
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
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { cardAreaForCheck } from '@/lib/sites/card-areas'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import sharp from 'sharp'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Cross-page preview worker verification', () => {
  const userId = 'preview-' + randomUUID(), projectId = 'preview-' + randomUUID()
  const origin = 'https://example.com', urls = ['/', '/pricing', '/features'].map(path => origin + path)
  let mode: 'failed' | 'partial' | 'missing' | 'healthy' | 'without-titles' | 'without-descriptions' | 'browser-only' | 'same-page' | 'head-truncated' = 'failed'
  let single: 'failed' | 'replacement' | 'unread' | 'redirected' | 'unsupported' | 'partial-image' | 'corrupt' | 'no-image' | 'invalid-image' | 'healthy' | undefined
  const imageRequests: string[] = []
  let png: Buffer
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml')
      response.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>'); return
    }
    if (single && request.url === '/peer-preview.png') { response.writeHead(200, { 'content-type': 'image/png' }).end(png); return }
    if (single && request.url?.startsWith('/media/')) {
      imageRequests.push(request.url)
      if (request.url === '/media/replacement.png' || single === 'healthy') {
        response.writeHead(200, { 'content-type': 'image/png' }).end(png); return
      }
      if (single === 'unsupported') {
        response.writeHead(200, { 'content-type': 'image/svg+xml' }).end('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>'); return
      }
      if (single === 'partial-image') {
        response.writeHead(206, { 'content-type': 'image/png', 'content-range': `bytes 0-${png.length - 1}/${png.length + 40}` }).end(png); return
      }
      if (single === 'corrupt') {
        response.writeHead(200, { 'content-type': 'image/png' }).end(png.subarray(0, 18)); return
      }
      response.writeHead(404).end('Image missing'); return
    }
    if (single && (request.url === '/' || request.url === '/changed-page')) {
      if (single === 'unread') { response.writeHead(503).end('Unavailable'); return }
      if (single === 'redirected' && request.url === '/') { response.writeHead(302, { location: '/changed-page' }); response.end(); return }
      const published = single === 'healthy' || single === 'redirected' || single === 'no-image' || single === 'invalid-image'
      const imageUrl = single === 'replacement' ? 'replacement.png' : single === 'invalid-image' ? 'javascript:void(0)' : 'original.png'
      response.setHeader('content-type', 'text/html')
      response.end('<!doctype html><html lang="en"><head><base href="/media/"><title>Service home</title>' +
        (published ? '<meta property="og:title" content="Published title"><meta property="og:description" content="Published description">' : '') +
        (single === 'no-image' ? '' : '<meta property="og:image:url" content="' + imageUrl + '">') +
        '<script>for(const [key,value] of Object.entries({title:"JavaScript title",description:"JavaScript description",image:"/media/replacement.png"})){' +
        'const tag=document.createElement("meta");tag.setAttribute("property","og:"+key);tag.content=value;document.head.prepend(tag)}</script>' +
        '</head><body><main><h1>Service home</h1></main></body></html>')
      return
    }
    if (mode === 'missing' && request.url === '/features') { response.writeHead(503); response.end('Unavailable'); return }
    if (mode === 'same-page' && request.url === '/features') { response.writeHead(302, { location: '/' }); response.end(); return }
    const unique = mode === 'healthy' || mode === 'without-titles' || mode === 'without-descriptions' || mode !== 'failed' && request.url === '/pricing'
    const title = unique ? 'Useful information ' + request.url : 'Shared preview title'
    const description = mode === 'without-descriptions' ? '' : unique ? 'Specific preview description for ' + request.url : 'The same long description used on every page.'
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>' + (mode === 'failed' ? 'Shared document title' : 'Page ' + request.url) + '</title><meta name="description" content="Useful service information.">' +
      (mode === 'head-truncated' && request.url === '/features' ? '<script>/* ' + 'x'.repeat(100_000) + ' */</script>' : '') +
      (mode === 'without-titles' ? '' : '<meta property="og:title" content="' + title + '">') + '<meta property="og:description" content="' + description + '">' +
      (single ? '<meta property="og:image" content="/peer-preview.png">' : '') +
      (mode === 'browser-only' ? '<script>document.querySelector(\'meta[property="og:title"]\').content = "Rendered " + location.pathname</script>' : '') + '</head>' +
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
    for (const queue of [getAuditQueue(), ...(Object.keys(TASK_QUEUES) as Array<keyof typeof TASK_QUEUES>).map(getAuditTaskQueue)]) {
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
  async function currentPreviews(auditId: string, passing: boolean) {
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    const spec = readExecutionSpec(audit.executionSpec)!
    expect(spec.checks).toMatchObject({ 'corridor-og-title-drift': 3, 'corridor-og-description-drift': 2 })
    const broad = await prisma.audit.findUniqueOrThrow({ where: { id: spec.category!.sourceAuditId } })
    const site = await loadSiteRecord(projectId)
    if (!site) throw new Error('The preview fixture Site is unavailable')
    const page = await loadSiteCheckResultPage(site, broad, undefined, undefined, { area: 'search' }, true)
    const captures = await prisma.auditExecutionTask.findMany({ where: { auditId, workKind: 'browser' }, select: { workInput: true } })
    expect(captures).toHaveLength(urls.length)
    expect(captures.every(task => (task.workInput as { device?: string }).device === 'desktop')).toBe(true)
    const previews = page.results.filter(result => result.name === 'Cross-page previews' ||
      ['preview-titles', 'preview-descriptions'].includes(result.assertionKey ?? ''))
    expect(previews).toHaveLength(8)
    expect(previews.filter(result => result.kind === 'assertion')).toHaveLength(6)
    expect(previews.every(result => result.area === 'search' && result.auditId === auditId && !result.historical &&
      result.evidenceReference.auditId === auditId)).toBe(true)
    const assertions = previews.filter(result => result.kind === 'assertion')
    expect(assertions.map(result => result.status), JSON.stringify(assertions)).toEqual(Array(6).fill(passing ? 'passed' : 'findings'))
  }
  it('keeps original page comparisons through partial evidence, repair and same-incident recurrence', async () => {
    const before = await category('preview-failure')
    await currentPreviews(before, false)
    const largeBrowser = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: before, workKind: 'browser', pageUrl: urls[2] } })
    expect(largeBrowser.workResult).toMatchObject({ data: { metadata: null, snapshot: { desktopHtml: null, desktopHtmlTruncated: true } } })
    const largeHttp = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: before, workKind: 'http', pageUrl: urls[2] } })
    expect(largeHttp.workResult).toMatchObject({ data: { document: { complete: false }, publicPreview: {
      scope: { pageUrl: urls[2], finalUrl: urls[2], access: 'public' }, ogTitle: 'Shared preview title',
    } } })
    const duplicate = await prisma.flag.findFirstOrThrow({ where: { auditId: before, checkId: 'search-duplicate-title' } })
    expect(duplicate.evidence).toContain('3 checked pages')
    const flags = await prisma.flag.findMany({ where: { auditId: before, checkId: { in: ['corridor-og-title-drift', 'corridor-og-description-drift'] } }, orderBy: { checkId: 'asc' } })
    expect(flags).toHaveLength(2)
    expect(flags.every(flag => cardAreaForCheck(flag) === 'search')).toBe(true)
    const flag = flags.find(item => item.checkId === 'corridor-og-title-drift')!
    expect(flag.affectedPaths).toEqual(expect.arrayContaining(urls))
    expect(flag.evidenceTargets).toHaveLength(2)
    mode = 'browser-only'
    const browserOnly = await category('preview-browser-only-fix')
    const changedDom = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: browserOnly, workKind: 'browser', pageUrl: urls[2] } })
    expect(changedDom.workResult).toMatchObject({ data: { snapshot: { runtimeHeadMetadata: { ogTitle: 'Rendered /features' } } } })
    const unchangedSource = await prisma.flag.findFirstOrThrow({ where: { auditId: browserOnly, checkId: flag.checkId } })
    expect(unchangedSource).toMatchObject({ status: 'OPEN', fingerprint: flag.fingerprint })
    for (const state of ['partial', 'browser-only', 'missing', 'without-titles', 'same-page', 'head-truncated', 'healthy'] as const) {
      mode = state
      const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'preview-fix-' + state,
        changeSummary: 'Give each original page a distinct preview title' })
      const result = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'preview-verification-' + state,
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId: before } })
      await complete(result.auditId!)
      const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })
      expect(attempt.outcome).toBe(state === 'healthy' ? 'IMPROVED' : state === 'partial' || state === 'browser-only' ? 'UNCHANGED' : 'INCONCLUSIVE')
      if (state === 'without-titles') {
        expect(attempt.comparable).toBe(false)
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).not.toMatchObject({ status: 'FIXED' })
        const receipts = await prisma.auditVerificationReceipt.findMany({ where: { auditId: result.auditId!, targetKey: 'module:corridor' } })
        expect(receipts.flatMap(receipt => checkReceiptSchema.parse(receipt.detail).assertions).filter(assertion => assertion.key === 'preview-titles'))
          .toEqual(expect.arrayContaining([expect.objectContaining({ complete: true, disposition: 'observed', passed: false })]))
      }
      if (state === 'same-page') {
        const receipts = await prisma.auditVerificationReceipt.findMany({ where: { auditId: result.auditId!, targetKey: 'module:corridor' } })
        expect(receipts.flatMap(row => checkReceiptSchema.parse(row.detail).assertions)).toContainEqual(expect.objectContaining({
          key: 'preview-titles', observed: 'Both URLs returned the same public page.', disposition: 'observed',
        }))
      }
      const tasks = await prisma.auditExecutionTask.findMany({ where: { auditId: result.auditId!, targetKey: { startsWith: 'task:' } } })
      expect(tasks.map(task => task.workKind).sort()).toEqual(['cross-page', 'finalize', 'http', 'http', 'http'])
      if (state === 'healthy') {
        const proof = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: result.auditId!, targetKey: 'check:corridor-og-title-drift' } })
        expect(checkVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', source: 'http', checkVersion: 3 })
        const receipts = await prisma.auditVerificationReceipt.findMany({ where: { auditId: result.auditId!, targetKey: 'module:corridor' } })
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
    const removedReceipts = await prisma.auditVerificationReceipt.findMany({ where: { auditId: removedRun.auditId!, targetKey: 'module:corridor' } })
    expect(removedReceipts.flatMap(receipt => checkReceiptSchema.parse(receipt.detail).assertions).filter(assertion => assertion.key === 'preview-descriptions'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ complete: true, disposition: 'observed', passed: false })]))
    mode = 'healthy'
    const descriptionFix = await recordSiteFlagFix({ siteId: projectId, flagId: description.id, userId, idempotencyKey: 'preview-description-fix',
      changeSummary: 'Give each original page a distinct preview description' })
    const descriptionRun = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'preview-description-verification',
      verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: description.pageUrl!, checkId: description.checkId!, attemptId: descriptionFix.attemptId, parentAuditId: before } })
    await complete(descriptionRun.auditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: descriptionFix.attemptId } })).toMatchObject({ outcome: 'IMPROVED' })
    const descriptionProof = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: descriptionRun.auditId!, targetKey: 'check:corridor-og-description-drift' } })
    expect(checkVerifierSchema.parse(descriptionProof.detail)).toMatchObject({ verdict: 'passed', assertion: { key: 'preview-descriptions' } })
    mode = 'failed'
    const recurring = await category('preview-recurrence')
    await currentPreviews(recurring, false)
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
    await currentPreviews(automatic, true)
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: automatic } })
    const summary = await getFlagDiffSummary(audit.parentId, automatic)
    expect(summary.fixed.map(item => item.checkId)).toEqual(expect.arrayContaining([flag.checkId, description.checkId]))
    for (const current of [recurrence, recurringDescription])
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: current.id } })).toMatchObject({ status: 'FIXED', resolvedInId: automatic })
  }, 240_000)

  it('verifies published preview declarations and pixels at the original image URL', async () => {
    png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#284c63' } }).png().toBuffer()
    mode = 'healthy'; single = 'failed'
    const before = await category('public-single-preview-baseline')
    const browser = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: before, workKind: 'browser', pageUrl: urls[0] } })
    expect(browser.workResult).toMatchObject({ data: { snapshot: { runtimeHeadMetadata: { ogTitle: 'JavaScript title', ogImage: origin + '/media/replacement.png' } } } })
    const http = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: before, workKind: 'http', pageUrl: urls[0] } })
    expect(http.workResult).toMatchObject({ data: { publicPreview: { ogTitle: null, ogDescription: null,
      ogImage: 'original.png', linkBaseUrl: origin + '/media/' } } })
    const ids = ['og-title-missing', 'og-description-missing', 'og-image-broken']
    const flags = await prisma.flag.findMany({ where: { auditId: before, pageUrl: urls[0], checkId: { in: ids } } })
    expect(flags.map(flag => flag.checkId)).toEqual(expect.arrayContaining(ids))
    expect(imageRequests).toContain('/media/original.png')
    expect(imageRequests).not.toContain('/media/replacement.png')
    const title = flags.find(flag => flag.checkId === 'og-title-missing')!
    const description = flags.find(flag => flag.checkId === 'og-description-missing')!
    const image = flags.find(flag => flag.checkId === 'og-image-broken')!
    async function verify(flag: typeof title, state: NonNullable<typeof single>, outcome: 'UNCHANGED' | 'INCONCLUSIVE' | 'IMPROVED', parentAuditId = before) {
      single = state
      const key = parentAuditId + '-' + flag.checkId + '-' + state
      const beforeImages = imageRequests.length
      const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'fix-' + key,
        changeSummary: 'Publish the intended link preview' })
      const result = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'verify-' + key,
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: urls[0], checkId: flag.checkId!, attemptId: fix.attemptId, parentAuditId } })
      await complete(result.auditId!)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome })
      const tasks = await prisma.auditExecutionTask.findMany({ where: { auditId: result.auditId! }, select: { workKind: true } })
      expect(tasks.map(task => task.workKind).sort()).toEqual(['check', 'finalize', 'http'])
      if (flag.checkId !== 'og-image-broken') expect(imageRequests).toHaveLength(beforeImages)
      if (outcome === 'IMPROVED') {
        const row = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: result.auditId!, targetKey: 'check:' + flag.checkId } })
        expect(checkVerifierSchema.parse(row.detail)).toMatchObject({ source: 'http', checkVersion: 2, comparable: true, verdict: 'passed' })
      }
    }
    await verify(title, 'failed', 'UNCHANGED')
    await verify(title, 'unread', 'INCONCLUSIVE')
    await verify(title, 'redirected', 'INCONCLUSIVE')
    await verify(title, 'healthy', 'IMPROVED')
    await verify(description, 'healthy', 'IMPROVED')
    await verify(image, 'replacement', 'INCONCLUSIVE')
    await verify(image, 'unsupported', 'INCONCLUSIVE')
    await verify(image, 'partial-image', 'INCONCLUSIVE')
    await verify(image, 'corrupt', 'UNCHANGED')
    await verify(image, 'healthy', 'IMPROVED')
    single = 'failed'
    const recurring = await category('public-single-preview-recurrence')
    for (const flag of [title, description, image]) {
      const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring, checkId: flag.checkId, pageUrl: urls[0] } })
      expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    }
    single = 'no-image'
    const absent = await category('public-single-image-absent')
    const declaration = await prisma.flag.findFirstOrThrow({ where: { auditId: absent, checkId: 'og-image-missing', pageUrl: urls[0] } })
    await verify(declaration, 'healthy', 'IMPROVED', absent)
    single = 'no-image'
    const absentAgain = await category('public-single-image-absent-again')
    expect(await prisma.flag.findFirstOrThrow({ where: { auditId: absentAgain, checkId: declaration.checkId, pageUrl: urls[0] } }))
      .toMatchObject({ status: 'REGRESSED', fingerprint: declaration.fingerprint })
    single = 'invalid-image'
    const invalid = await category('public-single-image-invalid')
    const malformed = await prisma.flag.findFirstOrThrow({ where: { auditId: invalid, checkId: 'og-image-broken', pageUrl: urls[0] } })
    expect(malformed.problem).toBe('og:image URL is invalid')
    await verify(malformed, 'healthy', 'IMPROVED', invalid)
  }, 180_000)
})
