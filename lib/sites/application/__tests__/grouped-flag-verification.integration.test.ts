import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { runSecurityHeaderChecks } from '@/lib/audit/checks/security-headers'
import { persistControlledNativeSource } from '@/lib/audit/progressive/__tests__/controlled-native-source'
import { ensureOwnedFlagIdentities, ownedFlagIdentityInclude } from '@/lib/improvements/owned-flag-identity'
import { createImprovementAttempt } from '@/lib/improvements/attempts'
import { coordinateProgressiveAudit, startProgressiveWorkers } from '@/lib/audit/progressive/runtime'
import { dispatchReadyTasks, reconcileTasks } from '@/lib/audit/progressive/engine'
import { TASK_QUEUES } from '@/lib/audit/progressive/queues'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { recordSiteFlagFix } from '../flag-verification'
import { executeSiteCommand } from '../commands'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFindings, loadSiteFlagDetail, loadSiteFlags, loadSiteResolvedFlags } from '@/lib/sites/flags'
import { getOwnedRun } from '../run-queries'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { probeFormValidation } from '@/lib/audit/flow/form-probes'
import { checkFormValidation } from '@/lib/audit/checks/form-validation'
import { runFlowScan } from '@/lib/audit/flow/run-flow-scan'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { buildExecutionSpec } from '../execution-spec'
import { initialTaskPlan } from '@/lib/audit/progressive/graph'
import { requestSiteRun } from '../run-requests'
import { recordedPageEvidence } from '@/lib/audit/progressive/lifecycle'
import { buildSiteRepairBrief } from '@/lib/sites/repair-brief'
import { getAppUrl } from '@/lib/get-app-url'
import { retryAudit } from '@/lib/audit/retry-audit'
import { expireUnownedExecution } from '@/lib/audit/execution-ownership'
import { writeProjectAccessGrant } from '@/lib/audit/scan-access-grants'
import { recordFlagFeedback } from '@/lib/improvements/feedback'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { touchWorkerHeartbeat, clearWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { loadAcceptedFlagRecoveries } from '../accepted-flag-recoveries'

vi.mock('node:dns/promises', async original => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture(({ ...await original<typeof import('node:dns/promises')>(),
  resolve4: async () => ['203.0.114.1'], resolve6: async () => [] })))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('grouped repair through the installed task workers', () => {
  const owner = 'grouped-repair-' + randomUUID(), origin = 'https://example.com'
  const checkId = 'security-csp-unsafe-inline', version = CHECK_REGISTRY[checkId].version
  const sources: Array<{ id: string; auditId: string; pageUrl: string }> = []
  let siteId: string, incidentId: string, workers: ReturnType<typeof startProgressiveWorkers> | undefined
  let mode: 'partial' | 'partial-unknown' | 'unknown' | 'healthy' = 'partial'
  const requests: string[] = []
  const previewHeaders: string[] = []
  let formMode: 'first-source' | 'second-source' | 'missing' | 'partial' | 'healthy' | 'new-control' | 'new-control-healthy' = 'first-source'
  const mutations: string[] = []
  const headers = (broken: boolean) => ({
    'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
    'cross-origin-opener-policy': 'same-origin', 'cross-origin-resource-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp', 'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy':
    "default-src 'self'; script-src 'self'" + (broken ? " 'unsafe-inline'" : '') + "; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" })
  const server = createServer((request, response) => {
    requests.push(request.url!)
    previewHeaders.push(String(request.headers['x-private-preview'] ?? ''))
    if (request.method !== 'GET' && request.method !== 'HEAD') mutations.push(request.method + ' ' + request.url)
    response.setHeader('content-type', 'text/html')
    if (request.url === '/forms') {
      const forms = ['first', 'second', ...(formMode.startsWith('new-control') ? ['third'] : [])]
        .filter(name => formMode === 'missing' ? name === 'first' : !formMode.endsWith('-source') || formMode === name + '-source')
      response.end('<!doctype html><html lang="en"><title>Contact us</title><main><h1>Contact us</h1>' + forms.map(name =>
        '<form id="' + name + '"><label>Email<input name="email" ' +
        (formMode === 'healthy' || formMode === 'new-control-healthy' || formMode === 'new-control' && name !== 'third' || ['partial', 'missing'].includes(formMode) && name === 'first' ? 'required' : 'aria-required="true"') +
        '></label><button>Contact ' + name + '</button></form>').join('') + '</main><script>document.querySelectorAll("form").forEach(form=>form.onsubmit=event=>event.preventDefault())</script></html>')
      return
    }
    if (request.url === '/actions' || request.url === '/pricing') {
      const pricing = request.url === '/pricing'
      response.end('<!doctype html><html lang="en"><title>Useful service for teams</title><main><h1>Manage your work with our service</h1>' +
        '<p>Review our service and choose the next step for your team.</p>' + (pricing ? '<nav>' : '') + ['first', 'second'].map(name =>
          '<a id="' + name + '" class="cta" ' + (formMode === 'missing' && name === 'second' || formMode.endsWith('-source') && formMode !== name + '-source' ? 'hidden ' : '') +
          'href="' + (pricing ? '#' + name + '-plan' : '/action-' + name) + '">' + (pricing ? 'Pricing ' : 'Get started ') + name + '</a>').join('') +
        (pricing ? '</nav>' + ['first', 'second'].filter(name => formMode === 'healthy' || ['partial', 'missing'].includes(formMode) && name === 'first')
          .map(name => '<section id="' + name + '-plan"><h2>Pricing for ' + name + '</h2><p>Choose the right plan for your team.</p></section>').join('') : '') + '</main></html>')
      return
    }
    if (request.url?.startsWith('/action-')) {
      response.statusCode = formMode === 'healthy' || ['partial', 'missing'].includes(formMode) && request.url === '/action-first' ? 200 : 404
      response.end('<!doctype html><html lang="en"><title>Choose your next step</title><main><h1>Choose the service for your team</h1><p>Read how our service helps you manage your work. Review the available plans before choosing your next step.</p></main></html>')
      return
    }
    if (request.url === '/first' && mode === 'unknown' || request.url === '/later' && mode === 'partial-unknown') response.statusCode = 403
    for (const [name, value] of Object.entries(headers(request.url === '/first' && mode.startsWith('partial')))) response.setHeader(name, value)
    response.end('<html><body>Controlled public response</body></html>')
  })
  async function source(path: string, targetSiteId = siteId, targetOwner = owner) {
    const pageUrl = origin + path
    const audit = await prisma.audit.create({ data: { userId: targetOwner, projectId: targetSiteId, url: pageUrl, status: 'COMPLETED',
      completedAt: new Date(), isPublic: false, executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl,
        environment: 'production', checks: { [checkId]: version }, outcomes: [], verificationTarget: null } } })
    const finding = runSecurityHeaderChecks(pageUrl, headers(true)).find(flag => flag.checkId === checkId)!
    expect(finding).toBeDefined()
    await persistControlledNativeSource(audit.id, [{ ...finding, pageUrl }], { MESSAGE: null, EXPERIENCE: null, REACH: null })
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId } })
    const identity = await prisma.$transaction(async tx => ensureOwnedFlagIdentities(tx,
      await tx.flag.findMany({ where: { id: flag.id }, include: ownedFlagIdentityInclude }), { userId: targetOwner, transport: 'fixture' }))
    const incident = identity.get(flag.id)!.improvementId
    if (targetSiteId === siteId) {
      if (incidentId) expect(incident).toBe(incidentId)
      incidentId = incident
      sources.push({ id: flag.id, auditId: audit.id, pageUrl })
    }
    return { id: flag.id, auditId: audit.id, pageUrl, incidentId: incident }
  }
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('Only the controlled fixture is available')
      return nativeFetch(transport + url.pathname, options)
    })
    const original = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => original(browser, url, { ...options,
      configurePage: async page => {
        await options.configurePage?.(page)
        await page.route('**', async route => {
          const resource = new URL(route.request().url())
          if (resource.origin !== origin) { await route.abort('blockedbyclient'); return }
          const response = await nativeFetch(transport + resource.pathname)
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
        })
      },
    }))
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', role: 'admin' } })
    siteId = (await prisma.project.create({ data: { userId: owner, name: 'Grouped repair', canonicalHost: 'example.com', url: origin } })).id
    await source('/first'); await source('/second')
    workers = startProgressiveWorkers()
  })
  afterAll(async () => {
    await workers?.close()
    await clearWorkerHeartbeat()
    await closeBrowser()
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(resource => getAuditTaskQueue(resource as keyof typeof TASK_QUEUES))]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    await prisma.user.deleteMany({ where: { id: { in: [owner, ...['forms', 'actions', 'pricing', 'retry', 'scope', 'revision', 'transfer-original', 'transfer-current', 'feedback-open', 'feedback-dismissed', 'feedback-retained', 'legacy-proof', 'grouped-proof'].map(kind => owner + '-' + kind)] } } })
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); await prisma.$disconnect()
  })
  async function verify(attemptId: string, key: string) {
    const admitted = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, flagId: incidentId, userId: owner, attemptId, idempotencyKey: key })
    if (!admitted.ok || !('verificationAuditId' in admitted)) throw new Error('Grouped repair was not admitted')
    const recorded = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    const site = (await loadSiteRecord(siteId))!
    for (const source of sources) {
      const selected = recorded.sourceFlagIds.includes(source.id)
      const detail = (await loadSiteFlagDetail(site, source.id))!
      expect(detail).toMatchObject({ verifying: selected, sourceAuditId: source.auditId })
      expect(detail.verificationState === 'verifying').toBe(selected)
    }
    const overview = (await loadSiteFindings(site)).flags.find(flag => flag.id === incidentId)!
    expect(overview.verificationState === 'verifying').toBe(recorded.sourceFlagIds.includes(overview.sourceFlagId!))
    await coordinateProgressiveAudit(admitted.verificationAuditId!)
    await vi.waitFor(async () => {
      await dispatchReadyTasks(await reconcileTasks(admitted.verificationAuditId!))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: admitted.verificationAuditId! } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 15_000, interval: 50 })
    const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    expect(await getOwnedRun(owner, admitted.runId!)).toMatchObject({ result: attempt.outcome === 'IMPROVED' ? 'CLEAR'
      : attempt.outcome === 'INCONCLUSIVE' ? 'COULD_NOT_VERIFY' : 'FLAG' })
    return attempt
  }
  it.each(['open', 'dismissed', 'retained'] as const)('keeps a repair claim open through a failed recheck and resolves it only after independent recovery (source=%s)', async state => {
    const userId = owner + '-feedback-' + state
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin' } })
    const site = await prisma.project.create({ data: { userId, name: 'Reported repair', canonicalHost: 'example.com', url: origin } })
    const original = await source('/first', site.id, userId)
    const observed = await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })
    async function declareAndVerify(key: string) {
      if (state === 'dismissed') {
        await recordFlagFeedback({ flagId: original.id, userId, visitorToken: 'owner-feedback', vote: -1, dismiss: true,
          reason: 'intentional', comment: 'Earlier accepted exception' })
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: 'IGNORED' })
      }
      await recordFlagFeedback({ flagId: original.id, userId, visitorToken: 'owner-feedback', vote: -1, dismiss: true,
        reason: 'already_fixed', comment: 'Removed inline script permission' })
      if (state === 'retained') {
        // Reproduce the former write after recording readiness, then apply the
        // actual migration before admitting the retained verification attempt.
        await prisma.flag.update({ where: { id: original.id }, data: { status: 'IGNORED' } })
        await prisma.$executeRawUnsafe(readFileSync(new URL('../../../../prisma/migrations/20261103230000_restore_declared_repair_attention/migration.sql', import.meta.url), 'utf8'))
      }
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toEqual(observed)
      const attempt = await prisma.improvementAttempt.findFirstOrThrow({ where: { improvementId: original.incidentId, outcome: null } })
      const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.id, flagId: original.id, userId,
        attemptId: attempt.id, idempotencyKey: key })
      if (!run.ok || !('verificationAuditId' in run)) throw new Error('Reported repair was not admitted')
      await coordinateProgressiveAudit(run.verificationAuditId!)
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(run.verificationAuditId!))
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.verificationAuditId! } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 20_000, interval: 50 })
      return { run, proof: await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempt.id } }) }
    }
    mode = 'partial'
    const failed = await declareAndVerify('feedback-unchanged')
    expect(failed.proof).toMatchObject({ comparable: true, outcome: 'UNCHANGED' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: 'OPEN' })
    expect(await getOwnedRun(userId, failed.run.runId!)).toMatchObject({ result: 'FLAG' })
    mode = 'healthy'
    const recovered = await declareAndVerify('feedback-recovered')
    expect(recovered.proof).toMatchObject({ comparable: true, outcome: 'IMPROVED' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } }))
      .toMatchObject({ status: 'FIXED', resolvedInId: recovered.run.verificationAuditId })
    expect(await getOwnedRun(userId, recovered.run.runId!)).toMatchObject({ result: 'CLEAR' })
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: failed.proof.id } })).toEqual(failed.proof)
  }, 60_000)

  it('repairs retained findings under the current Site owner without adopting the original actor or credentials', async () => {
    const originalOwner = owner + '-transfer-original', currentOwner = owner + '-transfer-current'
    await prisma.user.createMany({ data: [originalOwner, currentOwner].map(id => ({ id, email: id + '@example.test', role: 'admin' })) })
    const site = await prisma.project.create({ data: { userId: originalOwner, name: 'Retained repair', url: origin, canonicalHost: 'example.com',
      notificationLevel: 'OFF', accountChecksEnabled: false } })
    const first = await source('/first', site.id, originalOwner), second = await source('/second', site.id, originalOwner)
    const originals = await prisma.audit.findMany({ where: { id: { in: [first.auditId, second.auditId] } }, orderBy: { id: 'asc' } })
    const grant = writeProjectAccessGrant({ headers: { 'X-Private-Preview': 'retained-owner-fixture-secret' } }, origin)
    await prisma.project.update({ where: { id: site.id }, data: { userId: currentOwner,
      scanAccessEncrypted: grant.payload, scanAccessAuthorizedByUserId: originalOwner } })
    const command = { siteId: site.id, flagId: first.incidentId, userId: currentOwner,
      idempotencyKey: 'retained-owner-fix', changeSummary: 'Restore the original public script policies' }
    const fixed = await recordSiteFlagFix(command)
    const declared = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })
    expect(declared.sourceFlagIds.toSorted()).toEqual([first.id, second.id].toSorted())
    mode = 'healthy'; previewHeaders.length = 0
    const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.id, flagId: first.incidentId, userId: currentOwner,
      attemptId: fixed.attemptId, idempotencyKey: 'retained-owner-verification' })
    if (!verified.ok || !('verificationAuditId' in verified)) throw new Error('Retained repair was not admitted')
    await coordinateProgressiveAudit(verified.verificationAuditId!)
    await vi.waitFor(async () => {
      await dispatchReadyTasks(await reconcileTasks(verified.verificationAuditId!))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: verified.verificationAuditId! } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 15_000, interval: 50 })
    const proof = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })
    expect(proof).toMatchObject({ outcome: 'IMPROVED', comparable: true, sourceAuditId: declared.sourceAuditId })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: verified.verificationAuditId! } }))
      .toMatchObject({ userId: currentOwner, projectId: site.id, scanAccessEncrypted: null, executionSpec: { scanAccess: { kind: 'public' } } })
    expect(previewHeaders.length).toBeGreaterThan(0)
    expect(previewHeaders.every(value => value === '')).toBe(true)
    expect(await getOwnedRun(currentOwner, verified.runId!)).toMatchObject({ result: 'CLEAR' })
    expect((await recordSiteFlagFix(command)).attemptId).toBe(fixed.attemptId)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).toEqual(proof)
    expect(await prisma.audit.findMany({ where: { id: { in: [first.auditId, second.auditId] } }, orderBy: { id: 'asc' } })).toEqual(originals)
    mode = 'partial'
    const recurring = await requestSiteRun({ projectId: site.id, userId: currentOwner, source: 'WATCH', scope: 'SITE',
      outcomeIds: [], idempotencyKey: 'retained-owner-monitor' })
    await coordinateProgressiveAudit(recurring.auditId!)
    await vi.waitFor(async () => {
      // Provider acceptance is absent in this native fixture. Expire only
      // those optional recovery windows, retaining their unavailable evidence.
      await prisma.auditExecutionTask.updateMany({ where: { auditId: recurring.auditId!, workState: { not: 'COMPLETED' },
        workKind: { in: ['pagespeed', 'google', 'judge'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(recurring.auditId!))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: recurring.auditId! } }))
        .toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 90_000, interval: 200 })
    const recurred = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId }, include: { improvementOccurrence: true } })
    expect(recurred).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId: first.incidentId } })
    expect(await getOwnedRun(currentOwner, recurring.runId)).toMatchObject({ result: 'FLAG' })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: site.id } })).toMatchObject({
      userId: currentOwner, scanAccessEncrypted: grant.payload, scanAccessAuthorizedByUserId: originalOwner,
    })
  }, 120_000)

  it('refuses a changed repair revision at the locked declaration boundary', async () => {
    const userId = owner + '-revision'
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin' } })
    const site = await prisma.project.create({ data: { userId, name: 'Concurrent repair declaration', url: origin, canonicalHost: 'example.com' } })
    const original = await source('/first', site.id, userId)
    await prisma.audit.update({ where: { id: original.auditId }, data: { status: 'CHECKING', completedAt: null } })
    const brief = buildSiteRepairBrief(site.id, (await loadSiteFlagDetail((await loadSiteRecord(site.id))!, original.id))!, getAppUrl(), original.id)
    const read = prisma.improvement.findFirst.bind(prisma.improvement)
    let appended = false
    const race = vi.spyOn(prisma.improvement, 'findFirst').mockImplementation(async args => {
      const result = await read(args)
      if (!appended && args?.select?.id && args.where?.id === original.incidentId) {
        appended = true
        const late = runSecurityHeaderChecks(origin + '/later', headers(true)).find(flag => flag.checkId === checkId)!
        await persistControlledNativeSource(original.auditId, [{ ...late, pageUrl: origin + '/later' }], { MESSAGE: null, EXPERIENCE: null, REACH: null })
      }
      return result
    })
    try {
      await expect(recordSiteFlagFix({ siteId: site.id, flagId: original.id, userId, idempotencyKey: 'changed-during-declaration',
        expectedContextHash: brief.contextHash, changeSummary: 'Restore the originally retrieved policy' }))
        .rejects.toMatchObject({ status: 409, code: 'REPAIR_CONTEXT_CHANGED' })
      expect(appended).toBe(true)
      expect(await prisma.improvementAttempt.count({ where: { improvementId: original.incidentId } })).toBe(0)
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: original.incidentId } })).toMatchObject({ status: 'PROPOSED' })
    } finally { race.mockRestore() }
  })
  it('retains every frozen grouped recovery across source Audits when lifecycle projections are missing', async () => {
    const userId = owner + '-grouped-proof'
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin' } })
    const site = await prisma.project.create({ data: { userId, name: 'Retained grouped proof', url: origin, canonicalHost: 'example.com' } })
    const selected = [await source('/first', site.id, userId), await source('/second', site.id, userId)]
    const declared = await recordSiteFlagFix({ siteId: site.id, flagId: selected[0].incidentId, userId,
      idempotencyKey: 'grouped-retained-proof', changeSummary: 'Restore the script policy on both original pages' })
    const peer = await source('/later', site.id, userId)
    const admitted = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.id, flagId: selected[0].incidentId, userId,
      attemptId: declared.attemptId, idempotencyKey: 'grouped-retained-proof-check' })
    if (!admitted.ok || !('verificationAuditId' in admitted)) throw new Error('Grouped repair was not admitted')
    const previousMode = mode
    try {
      mode = 'healthy'; requests.length = 0
      await coordinateProgressiveAudit(admitted.verificationAuditId!)
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(admitted.verificationAuditId!))
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: admitted.verificationAuditId! } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 50 })
      expect(new Set(requests)).toEqual(new Set(['/first', '/second']))
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } }))
        .toMatchObject({ outcome: 'IMPROVED', comparable: true, sourceFlagIds: expect.arrayContaining(selected.map(flag => flag.id)) })
      expect(await prisma.flag.findMany({ where: { id: { in: selected.map(flag => flag.id) } } }))
        .toEqual(expect.arrayContaining(selected.map(flag => expect.objectContaining({ id: flag.id, status: 'FIXED', resolvedInId: admitted.verificationAuditId }))))
      // Reproduce a retained installation's omitted projection using genuine
      // worker-issued proof. The accepted source intent and receipts stay intact.
      await prisma.flag.updateMany({ where: { id: { in: selected.map(flag => flag.id) } }, data: { status: 'OPEN', resolvedInId: null } })
      await prisma.improvement.update({ where: { id: selected[0].incidentId }, data: { status: 'READY_TO_VERIFY' } })
      const targets = [...selected, peer].map(flag => ({ id: flag.id, auditId: flag.auditId, improvementId: flag.incidentId }))
      expect([...(await loadAcceptedFlagRecoveries(site.id, targets)).keys()].toSorted()).toEqual(selected.map(flag => flag.id).toSorted())
      const record = (await loadSiteRecord(site.id))!
      expect(await loadSiteFlags(record)).toMatchObject([{ sourceFlagId: peer.id }])
      for (const flag of selected) expect(await loadSiteFlagDetail(record, flag.id))
        .toMatchObject({ status: 'VERIFIED', resolvedInId: admitted.verificationAuditId, sourceFlagIds: [flag.id] })
      expect(await loadSiteResolvedFlags(record)).toMatchObject([{ resolvedInId: admitted.verificationAuditId,
        affectedPaths: expect.arrayContaining(selected.map(flag => flag.pageUrl)) }])
      expect((await loadSiteResolvedFlags(record))[0].affectedPaths).not.toContain(peer.pageUrl)

      const samePagePeer = await source('/first', site.id, userId)
      const allTargets = [...targets, { id: samePagePeer.id, auditId: samePagePeer.auditId, improvementId: samePagePeer.incidentId }]
      expect([...(await loadAcceptedFlagRecoveries(site.id, allTargets)).keys()].toSorted()).toEqual(selected.map(flag => flag.id).toSorted())
      expect(selected.map(flag => flag.id)).toContain((await loadSiteResolvedFlags(record))[0].sourceFlagId)

      const accepted = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } })
      const foreign = await prisma.project.create({ data: { userId, name: 'Another Site', url: 'https://foreign.example/', canonicalHost: 'foreign.example' } })
      await prisma.audit.update({ where: { id: accepted.sourceAuditId }, data: { projectId: foreign.id } })
      try {
        expect((await loadAcceptedFlagRecoveries(site.id, allTargets)).size).toBe(0)
        expect(await loadSiteResolvedFlags(record)).toEqual([])
      } finally {
        await prisma.audit.update({ where: { id: accepted.sourceAuditId }, data: { projectId: site.id } })
      }

      // A selected source's enlarged scope still needs a fresh full comparison.
      await prisma.audit.update({ where: { id: selected[0].auditId }, data: { status: 'CHECKING', completedAt: null } })
      const expanded = runSecurityHeaderChecks(origin + '/expanded', headers(true)).find(flag => flag.checkId === checkId)!
      await persistControlledNativeSource(selected[0].auditId, [{ ...expanded, pageUrl: origin + '/expanded' }], { MESSAGE: null, EXPERIENCE: null, REACH: null })
      expect([...(await loadAcceptedFlagRecoveries(site.id, allTargets)).keys()]).toEqual([selected[1].id])
      expect(await loadSiteResolvedFlags(record)).toMatchObject([{ sourceFlagId: selected[1].id, affectedPaths: [selected[1].pageUrl] }])
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } })).toEqual(accepted)
    } finally { mode = previousMode }
  })
  it.each(['before', 'after'] as const)('keeps a declared repair limited to its original observations when its source Flag grows %s verification', async timing => {
    const userId = owner + '-scope'
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin' } })
    const site = await prisma.project.create({ data: { userId, name: 'Growing source scope', url: origin, canonicalHost: 'example.com' } })
    const original = await source('/first', site.id, userId)
    await prisma.audit.update({ where: { id: original.auditId }, data: { status: 'CHECKING', completedAt: null } })
    const declared = await recordSiteFlagFix({ siteId: site.id, flagId: original.id, userId,
      idempotencyKey: 'original-observation', changeSummary: 'Restore the script policy on the originally observed page' })
    const append = async () => {
      const late = runSecurityHeaderChecks(origin + '/later', headers(true)).find(flag => flag.checkId === checkId)!
      await persistControlledNativeSource(original.auditId, [{ ...late, pageUrl: origin + '/later' }], { MESSAGE: null, EXPERIENCE: null, REACH: null })
      const enlarged = await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })
      expect(enlarged.affectedPaths).toEqual(expect.arrayContaining([original.pageUrl, origin + '/later']))
    }
    if (timing === 'before') await append()
    const admitted = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.id, flagId: original.id, userId,
      attemptId: declared.attemptId, idempotencyKey: 'original-observation-verification' })
    if (!admitted.ok || !('verificationAuditId' in admitted)) throw new Error('Original repair was not admitted')
    const verification = await prisma.audit.findUniqueOrThrow({ where: { id: admitted.verificationAuditId! } })
    const specification = readExecutionSpec(verification.executionSpec)!
    expect(specification.verificationScopes?.map(scope => scope.pageUrl)).toEqual([original.pageUrl])
    const previousMode = mode
    try {
      mode = 'healthy'; requests.length = 0
      await coordinateProgressiveAudit(verification.id)
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(verification.id))
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: verification.id } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 50 })
      expect(new Set(requests)).toEqual(new Set(['/first']))
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } }))
        .toMatchObject({ outcome: 'IMPROVED', comparable: true })
      if (timing === 'after') {
        expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verification.id })
        await append()
      }
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: original.incidentId } })).toMatchObject({ status: 'PROPOSED' })
      expect(await loadSiteFlagDetail((await loadSiteRecord(site.id))!, original.incidentId)).toMatchObject({ verificationState: 'still_open' })
      const grownSite = (await loadSiteRecord(site.id))!
      expect(await loadSiteFlagDetail(grownSite, original.id)).toMatchObject({ status: 'PROPOSED', resolvedInId: null })
      expect(await loadSiteFlags(grownSite)).toMatchObject([{ sourceFlagId: original.id }])
      expect(await loadSiteResolvedFlags(grownSite)).toEqual([])
      const recorded = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } })
      expect(await recordSiteFlagFix({ siteId: site.id, flagId: original.id, userId,
        idempotencyKey: 'original-observation', changeSummary: 'Restore the script policy on the originally observed page' }))
        .toMatchObject({ attemptId: declared.attemptId, outcome: 'IMPROVED' })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } })).toEqual(recorded)
      const remaining = await recordSiteFlagFix({ siteId: site.id, flagId: original.id, userId,
        idempotencyKey: 'remaining-observation', changeSummary: 'Restore the policy on every newly observed page' })
      const recheck = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.id, flagId: original.id, userId,
        attemptId: remaining.attemptId, idempotencyKey: 'remaining-observation-verification' })
      if (!recheck.ok || !('verificationAuditId' in recheck)) throw new Error('Remaining repair was not admitted')
      requests.length = 0
      await coordinateProgressiveAudit(recheck.verificationAuditId!)
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(recheck.verificationAuditId!))
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: recheck.verificationAuditId! } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 50 })
      expect(new Set(requests)).toEqual(new Set(['/first', '/later']))
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } }))
        .toMatchObject({ status: 'FIXED', resolvedInId: recheck.verificationAuditId })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } })).toEqual(recorded)
      // Retained installations may have accepted native evidence without its
      // lifecycle projection. Recheck the full live scope through that evidence.
      await prisma.flag.update({ where: { id: original.id }, data: { status: 'OPEN', resolvedInId: null } })
      await prisma.improvement.update({ where: { id: original.incidentId }, data: { status: 'READY_TO_VERIFY' } })
      expect(await loadSiteFlags(grownSite)).toEqual([])
      expect(await loadSiteFlagDetail(grownSite, original.id)).toMatchObject({ status: 'VERIFIED', resolvedInId: recheck.verificationAuditId })
      expect(await loadSiteResolvedFlags(grownSite)).toMatchObject([{ sourceFlagId: original.id, resolvedInId: recheck.verificationAuditId }])
    } finally { mode = previousMode; await prisma.user.delete({ where: { id: userId } }) }
  })
  it('requires every selected capture, preserves an inconclusive peer, and keeps later observations outside an idempotent repair', async () => {
    const originalIds = sources.map(flag => flag.id).sort()
    for (const [phase, outcome] of [['partial', 'UNCHANGED'], ['partial-unknown', 'UNCHANGED'], ['unknown', 'INCONCLUSIVE'], ['healthy', 'IMPROVED']] as const) {
      mode = phase; requests.length = 0
      const key = 'grouped-fix:' + phase
      const detail = (await loadSiteFlagDetail((await loadSiteRecord(siteId))!, incidentId))!
      const selected = detail.sourceFlagIds!.toSorted()
      const brief = buildSiteRepairBrief(siteId, detail, getAppUrl(), incidentId)
      const fixed = await recordSiteFlagFix({ siteId, flagId: incidentId, userId: owner, idempotencyKey: key,
        expectedContextHash: brief.contextHash, changeSummary: 'Restore the recorded script policy on both original pages' })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } }))
        .toMatchObject({ sourceFlagIds: selected })
      if (phase === 'partial') expect(selected).toEqual(originalIds)
      if (phase === 'partial') {
        await source('/later')
        await expect(recordSiteFlagFix({ siteId, flagId: incidentId, userId: owner, idempotencyKey: 'stale-repair-context',
          expectedContextHash: brief.contextHash, changeSummary: 'Repair from the original retrieved task' }))
          .rejects.toMatchObject({ status: 409, code: 'REPAIR_CONTEXT_CHANGED' })
        expect(await prisma.improvementAttempt.count({ where: { idempotencyKey: 'stale-repair-context' } })).toBe(0)
        const replay = await recordSiteFlagFix({ siteId, flagId: incidentId, userId: owner, idempotencyKey: key,
          expectedContextHash: brief.contextHash, changeSummary: 'Restore the recorded script policy on both original pages' })
        expect(replay.attemptId).toBe(fixed.attemptId)
        expect((await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).sourceFlagIds).toEqual(originalIds)
      }
      const result = await verify(fixed.attemptId, 'grouped-verify:' + phase)
      expect(result).toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
      const audit = await prisma.audit.findUniqueOrThrow({ where: { id: result.verificationAuditId! } })
      expect(readExecutionSpec(audit.executionSpec)?.verificationSourceFlagIds?.toSorted()).toEqual(selected)
      const expected = await prisma.flag.findMany({ where: { id: { in: selected } }, select: { pageUrl: true, status: true } })
      expect(new Set(requests)).toEqual(new Set(expected.map(flag => new URL(flag.pageUrl!).pathname)))
      if (phase !== 'healthy') expect(await prisma.flag.count({ where: { id: { in: originalIds }, status: 'FIXED' } })).toBe(0)
      else expect(expected.every(flag => flag.status === 'FIXED')).toBe(true)
    }
    const site = (await loadSiteRecord(siteId))!
    expect(await loadSiteFlagDetail(site, incidentId)).toMatchObject({ verificationState: 'verified' })
  }, 60_000)

  it('keeps a retained legacy recovery through workflow changes and recognizes its independent native recurrence', async () => {
    const userId = owner + '-legacy-proof'
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin' } })
    const site = await prisma.project.create({ data: { userId, name: 'Legacy recovered source', canonicalHost: 'example.com', url: origin + '/first' } })
    const original = await source('/first', site.id, userId)
    await prisma.auditPage.create({ data: { auditId: original.auditId, url: original.pageUrl, normalizedUrl: original.pageUrl,
      position: 0, role: 'primary', status: 'COMPLETED', completeness: 'FULL' } })
    const attemptId = randomUUID()
    const proof = await prisma.audit.create({ data: { userId, projectId: site.id, url: original.pageUrl, parentId: original.auditId,
      status: 'COMPLETED', completedAt: new Date(), executionSpec: { version: 1, engine: 'progressive-v1', scope: 'DIAGNOSTIC',
        targetUrl: original.pageUrl, environment: 'production', checks: { [checkId]: version }, outcomes: [],
        verificationTarget: { kind: 'DIAGNOSTIC', checkId, pageUrl: original.pageUrl, parentAuditId: original.auditId, attemptId } } } })
    // The retained system verdict is the legacy certificate. This fixture does
    // not invent native collection for that earlier verification.
    const accepted = await prisma.improvementAttempt.create({ data: { id: attemptId, improvementId: original.incidentId,
      sourceAuditId: original.auditId, verificationAuditId: proof.id, handoffReference: 'flag:' + original.id,
      builder: 'retained-legacy', outcome: 'IMPROVED', comparable: true } })
    await prisma.improvement.update({ where: { id: original.incidentId }, data: { status: 'READY_TO_VERIFY' } })
    const observed = await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })
    const snapshot = (await loadSiteRecord(site.id))!
    expect((await loadSiteFindings(snapshot)).flags).toEqual([])
    mode = 'partial'
    await getAuditBrowser()
    const diagnostics = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: diagnostics.connected, activeBrowserContexts: diagnostics.activeContexts,
      queueState: workers!.activeCount() > 0 ? 'active' : 'idle' })
    const run = await requestSiteRun({ projectId: site.id, userId, source: 'WEB', scope: 'CATEGORY', categoryArea: 'security',
      outcomeIds: [], idempotencyKey: 'legacy-native-recurrence' })
    await coordinateProgressiveAudit(run.auditId!)
    await vi.waitFor(async () => {
      await dispatchReadyTasks(await reconcileTasks(run.auditId!))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 30_000, interval: 50 })
    const current = await prisma.flag.findFirstOrThrow({ where: { auditId: run.auditId!, checkId } })
    expect(current.status).toBe('REGRESSED')
    const completed = await prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! } })
    expect((await getFlagDiffSummary(completed.parentId, completed.id)).regressed).toMatchObject([{ id: current.id }])
    expect((await loadSiteFindings(snapshot)).flags.find(flag => flag.checkId === checkId)).toMatchObject({ sourceFlagId: current.id, status: 'REGRESSED' })
    expect((await loadSiteResolvedFlags(snapshot)).find(flag => flag.sourceFlagId === original.id)).toMatchObject({ resolvedInId: proof.id })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toEqual(observed)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: accepted.id } })).toEqual(accepted)
  }, 60_000)
  it('retries an expired grouped verification through owner admission without replacing its frozen captures or resolving a later observation', async () => {
    const retryOwner = owner + '-retry'
    await prisma.user.create({ data: { id: retryOwner, email: retryOwner + '@example.test', role: 'admin' } })
    const site = await prisma.project.create({ data: { userId: retryOwner, name: 'Interrupted grouped repair', canonicalHost: 'example.com', url: origin } })
    const original = [await source('/first', site.id, retryOwner), await source('/second', site.id, retryOwner)]
    const selected = original.map(flag => flag.id).sort(), incident = original[0].incidentId
    expect(original[1].incidentId).toBe(incident)
    const fixed = await recordSiteFlagFix({ siteId: site.id, flagId: incident, userId: retryOwner, idempotencyKey: 'interrupted-group-fix',
      changeSummary: 'Restore both originally recorded script policies' })
    const initial = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.id, flagId: incident, userId: retryOwner,
      attemptId: fixed.attemptId, idempotencyKey: 'interrupted-group-verify' })
    if (!initial.ok || !('verificationAuditId' in initial)) throw new Error('Initial grouped verification was not admitted')
    const queued = await prisma.audit.findUniqueOrThrow({ where: { id: initial.verificationAuditId! } })
    expect(readExecutionSpec(queued.executionSpec)?.verificationSourceFlagIds?.toSorted()).toEqual(selected)
    // No task worker has received this queued execution. Expire it through the
    // ordinary terminal boundary rather than reopening or editing its graph.
    expect(await prisma.auditExecutionTask.count({ where: { auditId: queued.id } })).toBe(0)
    expect(await expireUnownedExecution(queued, new Date())).toBe(true)
    const failed = await prisma.audit.findUniqueOrThrow({ where: { id: queued.id } })
    const failedRequest = await prisma.runRequest.findUniqueOrThrow({ where: { id: initial.runId! } })
    expect(failedRequest.status).toBe('FAILED')
    const later = await source('/later', site.id, retryOwner)
    expect(later.incidentId).toBe(incident)
    const previousMode = mode
    try {
      mode = 'healthy'; requests.length = 0
      const viewer = { userId: retryOwner, visitorKey: '', anonymousAuditIds: [] }
      const retry = await retryAudit(queued.id, viewer)
      expect(retry.auditId).not.toBe(queued.id)
      const admitted = await prisma.audit.findUniqueOrThrow({ where: { id: retry.auditId! } })
      const before = readExecutionSpec(queued.executionSpec)!, after = readExecutionSpec(admitted.executionSpec)!
      expect(after.verificationTarget).toEqual(before.verificationTarget)
      expect(after.verificationSourceFlagIds?.toSorted()).toEqual(selected)
      await coordinateProgressiveAudit(admitted.id)
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(admitted.id))
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: admitted.id } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 15_000, interval: 50 })
      expect(new Set(requests)).toEqual(new Set(['/first', '/second']))
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } }))
        .toMatchObject({ sourceFlagIds: selected, verificationAuditId: admitted.id, outcome: 'IMPROVED', comparable: true })
      expect(await getOwnedRun(retryOwner, retry.runId!)).toMatchObject({ result: 'CLEAR' })
      expect(await prisma.flag.count({ where: { id: { in: selected }, status: 'FIXED', resolvedInId: admitted.id } })).toBe(2)
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: later.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
      expect(await loadSiteFlagDetail((await loadSiteRecord(site.id))!, incident)).toMatchObject({ verificationState: 'still_open' })
      expect(await retryAudit(queued.id, viewer)).toMatchObject({ auditId: admitted.id, runId: retry.runId, status: 'COMPLETED', reused: true })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: queued.id } })).toEqual(failed)
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: initial.runId! } })).toEqual(failedRequest)
    } finally { mode = previousMode }
  }, 30_000)
  it('refuses a selected capture outside this incident before recording a repair', async () => {
    const foreign = await prisma.project.create({ data: { userId: owner, name: 'Other Site', canonicalHost: 'other.example.com', url: 'https://other.example.com' } })
    const audit = await prisma.audit.create({ data: { projectId: foreign.id, userId: owner, url: foreign.url } })
    const flag = await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT', problem: 'Foreign scope',
      evidence: 'Other Site', whyItMatters: 'Other Site', fix: 'Other Site', confidence: 1, position: 0 } })
    await expect(createImprovementAttempt({ projectId: siteId, improvementId: incidentId, userId: owner,
      sourceAuditId: sources[0].auditId, sourceFlagIds: [sources[0].id, flag.id], handoffReference: 'flag:' + sources[0].id,
      builder: 'fixture', idempotencyKey: 'foreign-source' })).rejects.toMatchObject({ code: 'FIX_INTENT_MISMATCH' })
    expect(await prisma.improvementAttempt.count({ where: { idempotencyKey: 'foreign-source' } })).toBe(0)
  })
  it('resolves more than one legacy recovery batch while reusing one compatible page observation', async () => {
    mode = 'healthy'
    for (let index = 0; index < 105; index++) await source('/many')
    const selected = (await loadSiteFlagDetail((await loadSiteRecord(siteId))!, incidentId))!.sourceFlagIds!
    expect(selected).toHaveLength(105)
    const fixed = await recordSiteFlagFix({ siteId, flagId: incidentId, userId: owner,
      idempotencyKey: 'large-selected-repair', changeSummary: 'Restore the same script policy for every selected capture' })
    requests.length = 0
    expect(await verify(fixed.attemptId, 'large-selected-verification')).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    expect(requests).toEqual(['/many'])
    expect(await prisma.flag.count({ where: { id: { in: selected }, status: 'FIXED' } })).toBe(105)
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: incidentId } })).toMatchObject({ status: 'VERIFIED' })
  }, 30_000)
  it('upgrades historical repair rows without inventing a wider source scope', async () => {
    const migration = readFileSync(new URL('../../../../prisma/migrations/20261101180000_repair_source_scope/migration.sql', import.meta.url), 'utf8')
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`CREATE TEMP TABLE improvement_attempts (id TEXT PRIMARY KEY, "sourceAuditId" TEXT, "changeSummary" TEXT, outcome TEXT) ON COMMIT DROP`
      await tx.$executeRaw`INSERT INTO improvement_attempts VALUES ('original', 'source', 'Recorded historical repair', 'IMPROVED')`
      await tx.$executeRawUnsafe(migration)
      expect(await tx.$queryRaw`SELECT * FROM improvement_attempts`).toEqual([{ id: 'original', sourceAuditId: 'source',
        changeSummary: 'Recorded historical repair', outcome: 'IMPROVED', sourceFlagIds: [] }])
      await tx.$executeRaw`INSERT INTO improvement_attempts (id, "sourceAuditId") VALUES ('compatibility-writer', 'source')`
      expect(await tx.$queryRaw`SELECT "sourceFlagIds" FROM improvement_attempts WHERE id = 'compatibility-writer'`)
        .toEqual([{ sourceFlagIds: [] }])
      await tx.$executeRawUnsafe(readFileSync(new URL('../../../../prisma/migrations/20261103110000_repair_source_observations/migration.sql', import.meta.url), 'utf8'))
      expect(await tx.$queryRaw`SELECT id, "sourceObservations" FROM improvement_attempts ORDER BY id`)
        .toEqual([{ id: 'compatibility-writer', sourceObservations: null }, { id: 'original', sourceObservations: null }])
    })
  })
  it.each(['forms', 'actions', 'pricing'] as const)('independently rechecks every original control in grouped %s instead of accepting only the first control', async kind => {
    const pageUrl = origin + '/' + kind, formCheck = kind === 'forms' ? 'flow-form-no-validation' : kind === 'actions' ? 'flow-cta-404' : 'flow-pricing-nav-broken', formOwner = owner + '-' + kind
    await prisma.user.create({ data: { id: formOwner, email: formOwner + '@example.test', role: 'admin' } })
    const site = await prisma.project.create({ data: { userId: formOwner, name: 'Grouped form repair', canonicalHost: 'example.com', url: pageUrl } })
    const originals: string[] = [], incidents: string[] = []
    for (const name of ['first', 'second'] as const) {
      formMode = name === 'first' ? 'first-source' : 'second-source'
      const token = randomUUID(), session = await pageSessions.createAuditPage(await getAuditBrowser(), pageUrl,
        { profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, localFormValidationToken: token, deadline: Date.now() + 10_000 })
      try {
        let flags
        if (kind === 'forms') {
          const probe = await probeFormValidation(session.page, { isolated: true, localValidationToken: token, deadline: Date.now() + 4000 })
          expect(probe.evidence).toMatchObject({ disposition: 'failed', reason: 'missing_feedback' })
          flags = checkFormValidation(probe.evidence).flags
        } else {
          const observed = await runFlowScan(session.page, 'controlled-source', pageUrl, { mode: kind === 'actions' ? 'primary' : 'pricing',
            captureSteps: false, includeFormValidation: false, includeMobileNavigation: false, includePricingNavigation: false, deadlineMs: 8000 })
          flags = runFlowChecks(observed, null).filter(flag => flag.checkId === formCheck)
          expect(flags).toHaveLength(1)
        }
        const audit = await prisma.audit.create({ data: { projectId: site.id, userId: formOwner, url: pageUrl, status: 'COMPLETED', completedAt: new Date(),
          executionSpec: { version: 1, scope: 'SITE', environment: 'production', targetUrl: pageUrl, checks: { [formCheck]: CHECK_REGISTRY[formCheck].version }, outcomes: [], verificationTarget: null } } })
        await persistControlledNativeSource(audit.id, flags, { MESSAGE: null, EXPERIENCE: null, REACH: null })
        const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: formCheck } })
        const identity = await prisma.$transaction(async tx => ensureOwnedFlagIdentities(tx,
          await tx.flag.findMany({ where: { id: flag.id }, include: ownedFlagIdentityInclude }), { userId: formOwner, transport: 'fixture' }))
        originals.push(flag.id); incidents.push(identity.get(flag.id)!.improvementId)
      } finally { session.disposeNetwork(); await session.page.context().close() }
    }
    expect(new Set(incidents).size).toBe(1)
    for (const [phase, outcome] of [['missing', 'INCONCLUSIVE'], ['partial', 'UNCHANGED'], ['healthy', 'IMPROVED']] as const) {
      formMode = phase
      const fixed = await recordSiteFlagFix({ siteId: site.id, flagId: incidents[0], userId: formOwner,
        idempotencyKey: 'forms-fix:' + phase, changeSummary: 'Restore validation on both original forms' })
      const admitted = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.id, flagId: incidents[0], userId: formOwner,
        attemptId: fixed.attemptId, idempotencyKey: 'forms-verify:' + phase })
      if (!admitted.ok || !('verificationAuditId' in admitted)) throw new Error('Grouped form verification was not admitted')
      await coordinateProgressiveAudit(admitted.verificationAuditId!)
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(admitted.verificationAuditId!))
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: admitted.verificationAuditId! } }))
          .toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 25_000, interval: 100 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).toMatchObject({ outcome, comparable: outcome !== 'INCONCLUSIVE' })
      const tasks = await prisma.auditExecutionTask.findMany({ where: { auditId: admitted.verificationAuditId!, workKind: 'flow' } })
      expect(tasks).toHaveLength(1)
      const receipts = await prisma.auditVerificationReceipt.findMany({ where: { auditId: admitted.verificationAuditId!, targetKey: kind === 'forms' ? 'module:form-validation' : 'module:flow' } })
      expect(new Set(receipts.map(receipt => receipt.scopeKey)).size).toBe(2)
      if (phase !== 'healthy') expect(await prisma.flag.count({ where: { id: { in: originals }, status: 'FIXED' } })).toBe(0)
    }
    expect(mutations).toEqual([])
    expect(await prisma.flag.count({ where: { id: { in: originals }, status: 'FIXED' } })).toBe(2)
    const care = await buildExecutionSpec({ projectId: site.id, targetUrl: pageUrl, environment: 'production', scope: 'SITE', outcomes: [] })
    const nativeModule = kind === 'forms' ? 'form-validation' : kind === 'pricing' ? 'pricing-navigation' : undefined
    const retained = initialTaskPlan(care).filter(task => task.kind === 'flow' && task.input.module === nativeModule)
    expect(retained.flatMap(task => task.input.verificationContexts ?? [])).toHaveLength(2)
    async function monitor(key: string) {
      const run = await requestSiteRun({ projectId: site.id, userId: formOwner, outcomeIds: [], source: 'WATCH', scope: 'SITE',
        idempotencyKey: 'grouped-care:' + kind + ':' + key })
      if (kind === 'forms' && key === 'recovery') {
        // Unreadable historical rows are not observations. They must neither
        // certify repair nor hide the real native receipt collected below.
        await prisma.auditVerificationReceipt.createMany({ data: Array.from({ length: 1201 }, (_, index) => ({
          id: 'a-volume-' + run.auditId + '-' + String(index).padStart(5, '0'), auditId: run.auditId!, targetKey: 'module:form-validation',
          scopeKey: 'filler:' + index, source: 'DETERMINISTIC', status: 'COMPLETED' as const, detail: {},
        })) })
      }
      await coordinateProgressiveAudit(run.auditId!)
      await vi.waitFor(async () => {
        // Real care admission and native control collection remain intact.
        // Other capabilities are deliberately unavailable in this bounded fixture.
        const tasks = await prisma.auditExecutionTask.findMany({ where: { auditId: run.auditId!, workState: { not: 'COMPLETED' } },
          select: { id: true, workKind: true, workInput: true } })
        const omitted = tasks.filter(task => !['browser', 'http', 'check', 'finalize'].includes(task.workKind!) &&
          !(task.workKind === 'flow' && (task.workInput as { module?: string }).module === nativeModule)).map(task => task.id)
        if (omitted.length) await prisma.auditExecutionTask.updateMany({ where: { id: { in: omitted } }, data: { workRecoveryUntil: new Date(0) } })
        await dispatchReadyTasks(await reconcileTasks(run.auditId!))
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: run.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
      }, { timeout: 35_000, interval: 100 })
      return run.auditId!
    }
    formMode = 'partial'
    const recurrence = await monitor('recurrence')
    const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: recurrence, checkId: formCheck }, include: { improvementOccurrence: true } })
    expect(repeated).toMatchObject({ status: 'REGRESSED', improvementOccurrence: { improvementId: incidents[0] } })
    formMode = 'healthy'
    const recovered = await monitor('recovery')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: repeated.id } })).toMatchObject({ status: 'FIXED', resolvedInId: recovered })
    expect(await prisma.flag.count({ where: { id: { in: originals }, status: 'FIXED' } })).toBe(2)
    if (kind === 'forms') {
      formMode = 'new-control'
      const fresh = await monitor('new-control')
      const additional = await prisma.flag.findFirstOrThrow({ where: { auditId: fresh, checkId: formCheck } })
      expect(additional.evidenceTargets).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Contact third' })]))
      const page = (await recordedPageEvidence(fresh, pageUrl))[0]
      expect(page.flags).toEqual(expect.arrayContaining([expect.objectContaining({ checkId: formCheck,
        evidenceTargets: expect.arrayContaining([expect.objectContaining({ label: 'Contact third' })]) })]))
      formMode = 'new-control-healthy'
      const fixed = await recordSiteFlagFix({ siteId: site.id, flagId: additional.id, userId: formOwner,
        idempotencyKey: 'repair-early-control-observation', changeSummary: 'Restore validation on the newly observed form' })
      const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.id, flagId: additional.id, userId: formOwner,
        attemptId: fixed.attemptId, idempotencyKey: 'verify-early-control-observation' })
      if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Early control observation could not be verified')
      await coordinateProgressiveAudit(verification.verificationAuditId!)
      await vi.waitFor(async () => {
        await dispatchReadyTasks(await reconcileTasks(verification.verificationAuditId!))
        expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fixed.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
      }, { timeout: 20_000, interval: 100 })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: additional.id } })).toMatchObject({ status: 'FIXED', resolvedInId: verification.verificationAuditId })
    }
    expect(mutations).toEqual([])
  }, 120_000)
})
