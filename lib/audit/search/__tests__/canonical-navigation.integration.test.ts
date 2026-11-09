import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { readArtifact } from '@/lib/audit/progressive/contracts'
import { browserArtifactSchema } from '@/lib/audit/progressive/snapshots'
import { TASK_QUEUES } from '@/lib/audit/progressive/queues'
import { dispatchReadyTasks, reconcileTasks } from '@/lib/audit/progressive/engine'
import { searchAttentionSchema, searchReceiptSchema, searchVerifierSchema } from '../contracts'
import { readSupportingObservations } from '../../flag-observations'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('canonical HTTP authority through client navigation and installed workers', () => {
  const userId = 'canonical-navigation-' + randomUUID(), origin = 'https://example.com'
  const pageUrl = origin + '/', target = origin + '/article?view=full&lang=en'
  const replacement = origin + '/article?view=full&lang=fr'
  const syntaxPage = origin + '/canonical-syntax'
  const conflictPage = origin + '/canonical-conflict'
  let phase = 'missing', targetRequests = 0, unrelatedRequests = 0, aliasRedirectsPending = 0, projectId: string
  let worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') { response.statusCode = 404; response.end('No sitemap'); return }
    if (request.url?.startsWith('/ignored-')) {
      unrelatedRequests++
      response.statusCode = 404; response.end('Unrelated target'); return
    }
    if (request.url === '/alias') {
      aliasRedirectsPending++
      response.writeHead(302, { location: target }); response.end(); return
    }
    response.setHeader('content-type', 'text/html')
    if (request.url === '/canonical-syntax') {
      const invalid = '<link rel="canonical" href="javascript:invalid">'
      if (phase === 'syntax-invalid') response.setHeader('link', '<ftp://example.com/article>; rel=canonical')
      response.end('<!doctype html><html lang="en"><head><title>Canonical syntax fixture</title>' +
        (phase === 'syntax-invalid' ? invalid : '<link rel="canonical" href="/canonical-syntax">') +
        (phase === 'syntax-rendered-invalid' ? '<script>document.head.insertAdjacentHTML("beforeend",' + JSON.stringify(invalid) + ')</script>' : '') +
        '</head><body><h1>Canonical syntax fixture</h1></body></html>')
      return
    }
    if (request.url === '/canonical-conflict') {
      const link = phase === 'conflict' ? '<' + replacement + '>; rel=canonical' : '</canonical-conflict>; rel=canonical'
      response.setHeader('link', phase === 'conflict-incomplete' ? link + ', </unread>; title="unfinished' : link)
      response.end('<!doctype html><html lang="en"><head><title>Canonical conflict fixture</title>' +
        '<link rel="canonical" href="/canonical-conflict"></head><body><h1>Canonical conflict fixture</h1></body></html>')
      return
    }
    if (request.url === '/login') { response.end('<!doctype html><title>Sign in to continue</title>'); return }
    if (request.url === '/article?view=full&lang=fr') { response.end('<title>Replacement canonical article</title>'); return }
    if (request.url === '/article?view=full&lang=en') {
      targetRequests++
      const fromAlias = aliasRedirectsPending > 0
      if (fromAlias) aliasRedirectsPending--
      if (phase === 'missing' || phase === 'alias-404' && !fromAlias) { response.statusCode = 404; response.end('Missing canonical target'); return }
      if (phase === 'sign-in') { response.writeHead(302, { location: '/login' }); response.end(); return }
      if (phase === 'forbidden') { response.writeHead(403).end('Restricted canonical target'); return }
      if (phase === 'partial') {
        response.writeHead(206, { 'content-range': 'bytes 0-16/100' }); response.end('Partial document.'); return
      }
      if (phase === 'missing-interrupted') response.statusCode = 404
      if (phase === 'interrupted' || phase === 'missing-interrupted' || phase === 'alias-interrupted' && !fromAlias) {
        response.write('<html><body>Incomplete canonical target'); setTimeout(() => response.destroy(), 20); return
      }
      response.end('<html><head><title>Canonical article</title></head><body><h1>Canonical article</h1></body></html>'); return
    }
    response.setHeader('link', [
      '</ignored-relation>; rel=canonicalized',
      '</ignored-anchor>; rel=canonical; anchor="/another-page"',
      ...(phase.startsWith('alias-') ? ['</alias>; rel=canonical'] : []),
      '<' + (phase === 'replacement' ? replacement : target) + '>; title="primary, public"; rel="alternate canonical"',
      ...(phase === 'malformed-link' ? ['</ignored-malformed>; title="unfinished'] : []),
    ])
    response.end('<!doctype html><html lang="en"><head><title>Useful application page</title><meta name="description" content="Read useful information for your team.">' +
      '<link rel="canonical" href="/ignored-language" hreflang="fr">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>' +
      '<h1>Useful application page</h1><p>Read useful information before choosing your next step.</p></main><link rel="canonical" href="/ignored-body">' +
      '<script>history.replaceState(null,"",' + JSON.stringify(target) + ')</script></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('External provider unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    const create = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => create(browser, url, { ...options,
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
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin', auditsLimit: 100 } })
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const browser = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: browser.connected, activeBrowserContexts: browser.activeContexts })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    await prisma.user.deleteMany({ where: { id: userId } })
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function complete(auditId: string) {
    await vi.waitFor(async () => {
      // These optional collection paths are deliberately unavailable. The
      // HTTP, browser and Search collectors below execute against the fixture.
      await prisma.auditExecutionTask.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
        workKind: { notIn: ['http', 'browser', 'check', 'finalize', 'search', 'search-resources', 'discovery', 'cross-page'] } },
        data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 60_000, interval: 100 })
  }
  async function verify(flagId: string, next: string, outcome: 'UNCHANGED' | 'INCONCLUSIVE' | 'IMPROVED') {
    phase = next
    const before = targetRequests
    const fix = await recordSiteFlagFix({ siteId: projectId, userId, flagId, idempotencyKey: 'canonical-fix-' + next,
      changeSummary: 'Restore the original canonical target response' })
    const check = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: projectId, userId, flagId,
      attemptId: fix.attemptId, idempotencyKey: 'canonical-verify-' + next })
    if (!check.ok || !('verificationAuditId' in check)) throw new Error('Canonical verification was not admitted')
    await complete(check.verificationAuditId!)
    if (next !== 'replacement') expect(targetRequests).toBeGreaterThan(before)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
      .toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
    if (next.startsWith('alias-')) {
      const receipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: {
        auditId: check.verificationAuditId!, targetKey: 'module:search-canonical' } })
      expect(searchReceiptSchema.parse(receipt.detail).observations).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'search-canonical-target:' + origin + '/alias', disposition: 'passed' }),
        expect.objectContaining({ id: 'search-canonical-target:' + target, disposition: outcome === 'UNCHANGED' ? 'failed' : 'unknown' }),
      ]))
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN' })
    }
    if (next === 'sign-in') {
      const receipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: {
        auditId: check.verificationAuditId!, targetKey: 'module:search-canonical' } })
      expect(searchReceiptSchema.parse(receipt.detail).observations).toContainEqual(expect.objectContaining({
        id: 'search-canonical-target:' + target, disposition: 'unknown', observed: expect.stringContaining('redirecting to sign-in'),
      }))
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN' })
    }
    if (next === 'partial' || next === 'missing-interrupted' || next === 'forbidden') {
      const receipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: {
        auditId: check.verificationAuditId!, targetKey: 'module:search-canonical' } })
      expect(searchReceiptSchema.parse(receipt.detail).observations).toContainEqual(expect.objectContaining({
        id: 'search-canonical-target:' + target, disposition: next === 'missing-interrupted' ? 'failed' : 'unknown',
        observed: target + (next === 'forbidden' ? ': HTTP 403' : next === 'partial' ? ': HTTP 206' : ': HTTP 404'),
      }))
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN' })
    }
    if (next === 'replacement') {
      const receipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: {
        auditId: check.verificationAuditId!, targetKey: 'module:search-canonical' } })
      const observations = searchReceiptSchema.parse(receipt.detail).observations
      expect(observations).toContainEqual(expect.objectContaining({
        id: 'search-canonical-target:' + replacement, disposition: 'passed',
      }))
      expect(observations.some(item => item.id === 'search-canonical-target:' + target)).toBe(false)
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN' })
    }
    const run = await prisma.runRequest.findFirstOrThrow({ where: { auditId: check.verificationAuditId! }, select: { id: true } })
    expect(await getOwnedRun(userId, run.id)).toMatchObject({ result: outcome === 'IMPROVED' ? 'CLEAR'
      : outcome === 'UNCHANGED' ? 'FLAG' : 'COULD_NOT_VERIFY' })
    if (outcome === 'IMPROVED') {
      const proof = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: {
        auditId: check.verificationAuditId!, targetKey: 'check:search-canonical-target',
      } })
      expect(searchVerifierSchema.parse(proof.detail)).toMatchObject({ verdict: 'passed', comparable: true,
        observationIds: ['search-canonical-target:' + target] })
    }
  }
  it('refuses borrowed rendered success, independently observes the canonical target, verifies repair and preserves recurrence', async () => {
    const source = await createAndEnqueueAudit({ admission: { kind: 'new-check' },
    url: pageUrl,
    userId })
    await complete(source.auditId)
    projectId = (await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).projectId!
    const browser = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: source.auditId, targetKey: 'task:p0:browser', workKind: 'browser', pageUrl } })
    expect(browserArtifactSchema.parse(readArtifact(browser.workResult, 'browser').data).snapshot)
      .toMatchObject({ desktopFinalUrl: target, desktopHttpStatus: 200 })
    const receipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: source.auditId, targetKey: 'module:search-canonical' } })
    expect(searchReceiptSchema.parse(receipt.detail).observations).toContainEqual(expect.objectContaining({
      checkId: 'search-canonical-target', disposition: 'failed', observed: target + ': HTTP 404' }))
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId: 'search-canonical-target' } })
    expect((await loadSiteHome(projectId))?.flags).toContainEqual(expect.objectContaining({ sourceFlagId: flag.id }))
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).toMatchObject({ url: pageUrl })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ url: origin })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    // Exercise the stored v5 Flag format from before explicit resource keys.
    const withoutKeys = (value: unknown) => {
      const policy = searchAttentionSchema.parse(value)
      delete policy.resourceKeys
      for (const scope of policy.pageScopes ?? []) delete scope.resourceKeys
      return policy
    }
    const original = readSupportingObservations(flag.supportingObservations)!
    await prisma.flag.update({ where: { id: flag.id }, data: { attentionPolicy: withoutKeys(flag.attentionPolicy),
      supportingObservations: { version: 1, items: original.items.map(item => ({ ...item, attentionPolicy: withoutKeys(item.attentionPolicy) })) } } })
    await verify(flag.id, 'missing', 'UNCHANGED')
    await verify(flag.id, 'missing-interrupted', 'UNCHANGED')
    await verify(flag.id, 'interrupted', 'INCONCLUSIVE')
    await verify(flag.id, 'partial', 'INCONCLUSIVE')
    await verify(flag.id, 'forbidden', 'INCONCLUSIVE')
    await verify(flag.id, 'sign-in', 'INCONCLUSIVE')
    await verify(flag.id, 'alias-404', 'UNCHANGED')
    await verify(flag.id, 'alias-interrupted', 'INCONCLUSIVE')
    await verify(flag.id, 'malformed-link', 'INCONCLUSIVE')
    await verify(flag.id, 'replacement', 'INCONCLUSIVE')
    await verify(flag.id, 'healthy', 'IMPROVED')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    phase = 'missing'
    const recurring = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'canonical-recurrence' })
    await complete(recurring.auditId!)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: flag.checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } }))
      .toMatchObject({ improvementId: occurrence.improvementId })
    expect(unrelatedRequests).toBe(0)
  }, 180_000)

  it('checks canonical syntax in the original HTML, Link field and live head before confirming repair', async () => {
    const checkId = 'search-canonical-invalid'
    phase = 'syntax-invalid'
    const source = await createAndEnqueueAudit({ admission: { kind: 'new-check' }, url: syntaxPage, userId })
    await complete(source.auditId)
    const siteId = (await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).projectId!
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId } })
    expect(searchAttentionSchema.parse(flag.attentionPolicy)).toMatchObject({ version: 6,
      sources: ['original-html', 'http', 'rendered-dom'] })
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    for (const [next, outcome] of [['syntax-rendered-invalid', 'UNCHANGED'], ['syntax-healthy', 'IMPROVED']] as const) {
      phase = next
      const fix = await recordSiteFlagFix({ siteId, userId, flagId: flag.id, idempotencyKey: 'fix-' + next,
        changeSummary: 'Correct the canonical declaration in the response and rendered page' })
      const result = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId, flagId: flag.id,
        attemptId: fix.attemptId, idempotencyKey: 'verify-' + next })
      if (!result.ok || !('verificationAuditId' in result) || !result.verificationAuditId) throw new Error('Syntax verification was not admitted')
      await complete(result.verificationAuditId)
      const row = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: result.verificationAuditId, targetKey: 'module:search-canonical' } })
      expect(searchReceiptSchema.parse(row.detail).observations.filter(item => item.checkId === checkId)).toMatchObject([
        { source: 'original-html', disposition: 'passed' },
        { source: 'http', disposition: 'passed' },
        { source: 'rendered-dom', disposition: next === 'syntax-healthy' ? 'passed' : 'failed' },
      ])
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome, comparable: true })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: outcome === 'IMPROVED' ? 'FIXED' : 'OPEN' })
    }
    phase = 'syntax-invalid'
    const recurring = await requestSiteRun({ projectId: siteId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'canonical-syntax-recurrence' })
    await complete(recurring.auditId!)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } }))
      .toMatchObject({ improvementId: occurrence.improvementId })
  }, 90_000)

  it('requires comparable HTML and HTTP declarations to verify a canonical conflict and observes recurrence', async () => {
    const checkId = 'search-canonical-conflict'
    phase = 'conflict'
    const source = await createAndEnqueueAudit({ admission: { kind: 'new-check' }, url: conflictPage, userId })
    await complete(source.auditId)
    const siteId = (await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).projectId!
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId, checkId } })
    expect(flag.evidence).toContain(replacement)
    expect(flag.evidence).toContain(conflictPage)
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    for (const [next, outcome] of [['conflict-incomplete', 'INCONCLUSIVE'], ['conflict-healthy', 'IMPROVED']] as const) {
      phase = next
      const fix = await recordSiteFlagFix({ siteId, userId, flagId: flag.id, idempotencyKey: 'fix-' + next,
        changeSummary: 'Use the same preferred URL in the HTML and HTTP response' })
      const result = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId, flagId: flag.id,
        attemptId: fix.attemptId, idempotencyKey: 'verify-' + next })
      if (!result.ok || !('verificationAuditId' in result) || !result.verificationAuditId) throw new Error('Conflict verification was not admitted')
      await complete(result.verificationAuditId)
      const row = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: result.verificationAuditId, targetKey: 'module:search-canonical' } })
      expect(searchReceiptSchema.parse(row.detail).observations.find(item => item.checkId === checkId))
        .toMatchObject({ disposition: outcome === 'IMPROVED' ? 'passed' : 'observed' })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } }))
        .toMatchObject({ outcome, comparable: outcome === 'IMPROVED' })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: outcome === 'IMPROVED' ? 'FIXED' : 'OPEN' })
    }
    phase = 'conflict'
    const recurring = await requestSiteRun({ projectId: siteId, userId, outcomeIds: [], source: 'WEB', scope: 'SITE', idempotencyKey: 'canonical-conflict-recurrence' })
    await complete(recurring.auditId!)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } }))
      .toMatchObject({ improvementId: occurrence.improvementId })
  }, 90_000)
})
