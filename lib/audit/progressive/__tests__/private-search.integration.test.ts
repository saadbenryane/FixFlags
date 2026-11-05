import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '../../screenshot'
import { persistProjectScanAccess } from '../../scan-access-store'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { requestScheduledSiteRun } from '@/lib/sites/application/scheduled-runs'
import { fromStoredWatchInterval } from '../../watch-interval'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { searchReceiptSchema } from '../../search/contracts'
import { assessSearchRecovery } from '../../search/recovery'
import { readArtifact } from '../contracts'
import { browserArtifactSchema } from '../snapshots'
import { TASK_QUEUES } from '../queues'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('public Search with credentialed browser collection', () => {
  const userId = 'private-search-' + randomUUID(), projectId = userId + '-site'
  const privateTitle = 'PRIVATE_RENDERED_WORKSPACE', accessValue = 'PRIVATE_FIXTURE_ACCESS'
  const requests: Array<{ path: string; private: boolean }> = []
  let url = '', repaired = false, worker: ReturnType<typeof startWorker> | undefined
  const server = createServer((request, response) => {
    const authenticated = request.headers['x-search-fixture'] === accessValue
    requests.push({ path: request.url!, private: authenticated })
    if (request.url === '/robots.txt') { response.end('User-agent: *\nAllow: /\nSitemap: ' + url + 'sitemap.xml'); return }
    if (request.url === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml')
      response.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + url + '</loc></url></urlset>'); return
    }
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head>' + (authenticated ? '<title>' + privateTitle + '</title>'
      : repaired ? '<title>Public website</title>' : '') +
      '<meta name="description" content="A useful public website."><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<link rel="canonical" href="' + (authenticated ? url + 'private-canonical' : url) + '"></head>' +
      '<body><main><h1>Useful service</h1><p>Clear public information.</p></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    url = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/'
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    const nativeFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (target.origin === new URL(url).origin) return nativeFetch(input, options)
      if (target.hostname === 'www.googleapis.com') return Promise.resolve(new Response('{}', { status: 403 }))
      throw new Error('External transport unavailable in this fixture')
    })
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, canonicalHost: '127.0.0.1', url, name: 'Public Search fixture',
      notificationLevel: 'OFF', accountChecksEnabled: false } })
    await persistProjectScanAccess(projectId, userId, { headers: { 'X-Search-Fixture': accessValue } })
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    await touchWorkerHeartbeat({ browserOk: getBrowserDiagnostics().connected, activeBrowserContexts: 0, queueState: 'idle' })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(resource => getAuditTaskQueue(resource as keyof typeof TASK_QUEUES))]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.user.deleteMany({ where: { id: userId } }); await prisma.$disconnect(); vi.unstubAllGlobals(); vi.unstubAllEnvs()
  })
  async function complete(auditId: string) {
    await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
      .toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 90_000, interval: 100 })
    const receipts = await prisma.auditVerificationReceipt.findMany({ where: { auditId, targetKey: { startsWith: 'module:search' } } })
    expect(JSON.stringify(receipts)).not.toContain(privateTitle)
    expect(JSON.stringify(receipts)).not.toContain(accessValue)
    expect(requests.some(request => request.path === '/private-canonical')).toBe(false)
    return receipts
  }
  it('flags and independently repairs the public original without using the private DOM, then recognizes recurrence', async () => {
    const source = await requestSiteRun({ projectId, userId, scope: 'SITE', source: 'WEB', outcomeIds: [], idempotencyKey: 'public-source' })
    const receipts = await complete(source.auditId!)
    const browser = await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: source.auditId!, workKind: 'browser',
      workInput: { path: ['device'], equals: 'desktop' } } })
    expect(browserArtifactSchema.parse(readArtifact(browser.workResult, 'browser').data).metadata?.title).toBe(privateTitle)
    expect(requests).toEqual(expect.arrayContaining([{ path: '/', private: false }, { path: '/', private: true },
      { path: '/robots.txt', private: false }, { path: '/sitemap.xml', private: false }]))
    const flag = await prisma.flag.findFirst({ where: { auditId: source.auditId!, checkId: 'title-missing' } })
    expect(flag).not.toBeNull()
    expect(flag!.attentionPolicy).toMatchObject({ sources: ['original-html'] })
    const presentation = searchReceiptSchema.parse(receipts.find(receipt => receipt.targetKey === 'module:search-presentation')!.detail)
    expect(presentation.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkId: 'title-missing', source: 'original-html', disposition: 'failed' }),
      expect.objectContaining({ checkId: 'title-missing', source: 'rendered-dom', disposition: 'unknown', reason: 'private_capture' }),
    ]))
    const identity = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag!.id } })
    repaired = true
    const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag!.id, userId, idempotencyKey: 'public-fix', changeSummary: 'Restore the public document title' })
    const verified = await requestSiteRun({ projectId, userId, source: 'WEB', outcomeIds: [], idempotencyKey: 'public-verification',
      verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: url, checkId: flag!.checkId!, parentAuditId: source.auditId!, attemptId: fix.attemptId } })
    const verifiedReceipts = await complete(verified.auditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    const proof = searchReceiptSchema.parse(verifiedReceipts.find(receipt => receipt.targetKey === 'module:search-presentation')!.detail)
    expect(assessSearchRecovery(proof, 'title-missing', flag!.attentionPolicy, url)).toMatchObject({ verdict: 'passed', comparable: true })
    expect(assessSearchRecovery(proof, 'title-missing', { ...(flag!.attentionPolicy as object), source: 'rendered-dom', sources: ['rendered-dom'] }, url))
      .toMatchObject({ verdict: 'unknown', comparable: false })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag!.id } })).toMatchObject({ status: 'FIXED' })
    repaired = false
    const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const interval = fromStoredWatchInterval(site.watchInterval)
    if (!interval) throw new Error('The fixture Site must retain automatic monitoring')
    // Advance admission freshness only. Native collection and worker leases
    // retain real time; this does not establish natural monitoring cadence.
    const tick = new Date(Date.now() + 8 * 86400_000)
    const recurring = await requestScheduledSiteRun({ projectId, userId, interval, everyMinutes: site.watchEveryMinutes,
      scheduledAt: tick, now: tick })
    await complete(recurring.auditId!)
    const monitored = await prisma.audit.findUniqueOrThrow({ where: { id: recurring.auditId! },
      select: { recheckTrigger: true, executionSpec: true, scanAccessEncrypted: true } })
    expect(monitored.recheckTrigger).toBe('WATCH')
    expect(monitored.executionSpec).toMatchObject({ scope: 'SITE' })
    expect(Boolean(monitored.scanAccessEncrypted)).toBe(true)
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: 'title-missing' } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag!.fingerprint })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: identity.improvementId })
  }, 180_000)
})
