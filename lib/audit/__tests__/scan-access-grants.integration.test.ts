import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { persistProjectScanAccess, admitScanAccess, resolveAuditScanAccess } from '../scan-access-store'
import { decryptScanAccess, encryptScanAccess } from '../scan-access'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { materializeAttentionForAudit } from '@/lib/improvements/service'
import { withExecutionOwnership, executionWrite, ExecutionOwnershipLost } from '../execution-ownership'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import * as pageSessions from '../browser/page-session'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('durable scan access grants', () => {
  const suffix = randomUUID(), owner = 'access-owner-' + suffix, site = 'access-site-' + suffix
  let url = ''
  const base = () => ({ version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'SITE', checks: {}, outcomes: [], verificationTarget: null } as const)
  const config = (value: string) => ({ headers: { 'X-Preview': value } })
  let worker: ReturnType<typeof startWorker> | undefined
  let observedToken = ''
  const server = createServer((request, response) => {
    observedToken = String(request.headers['x-preview'] ?? '')
    response.setHeader('content-type', 'text/html')
    response.end('<html><head><title>Useful website information</title></head><body><main><h1>Useful service for teams</h1><p>Read useful information about our service.</p><button>Read details</button></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname)) throw new Error('Use the disposable execution verifier')
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    url = 'https://example.com/'
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: site, userId: owner, canonicalHost: 'example.com', url, name: 'Access fixture' } })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await getAuditQueue().close()
    for (const name of ['http', 'browser', 'provider', 'evaluate', 'availability'] as const) await getAuditTaskQueue(name).close()
    await closeBrowser(); server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await prisma.user.delete({ where: { id: owner } }); await prisma.$disconnect(); vi.unstubAllEnvs()
  })
  async function savedAudit(intent: Awaited<ReturnType<typeof admitScanAccess>>, status: 'QUEUED' | 'COMPLETED' = 'QUEUED') {
    return prisma.audit.create({ data: { userId: owner, projectId: site, url, isPublic: false, status,
      scanAccessEncrypted: intent.config ? encryptScanAccess(intent.config) : null, executionSpec: { ...base(), scanAccess: intent.intent },
      dispatchState: 'SENT', dispatchNextAt: new Date('2100-01-01'), ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}) } })
  }
  it('revokes inherited work, fences stale writers, preserves independent admissions and cannot revive an old reference', async () => {
    await persistProjectScanAccess(site, owner, config('OLD_SECRET'))
    const inherited = await admitScanAccess(prisma, { projectId: site, userId: owner, targetUrl: url })
    const pending = await savedAudit(inherited), completed = await savedAudit(inherited, 'COMPLETED')
    const publicAudit = await savedAudit(await admitScanAccess(prisma, { projectId: site, userId: owner, targetUrl: url, useProject: false }))
    const oneOff = await savedAudit(await admitScanAccess(prisma, { projectId: site, userId: owner, targetUrl: url, explicit: config('ONE_OFF_SECRET') }))
    const task = await prisma.auditVerifierExecution.create({ data: { auditId: pending.id, targetKey: 'task:browser', scopeKey: 'page:' + url,
      source: 'DETERMINISTIC', workKind: 'browser', workState: 'RUNNING', status: 'RUNNING', workToken: 'original-worker', workGeneration: 1,
      workLeaseUntil: new Date(Date.now() + 90_000) } })
    await persistProjectScanAccess(site, owner, { ...config('OLD_SECRET'), label: 'Only the handoff note changed' })
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('QUEUED')
    await persistProjectScanAccess(site, owner, null)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({ status: 'FAILED', failureCode: 'SCAN_ACCESS_CHANGED' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: completed.id } })).toMatchObject({ status: 'COMPLETED' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: publicAudit.id } })).toMatchObject({ status: 'QUEUED' })
    expect(await resolveAuditScanAccess(publicAudit.id)).toBeNull()
    expect(await resolveAuditScanAccess(oneOff.id)).toMatchObject({ headers: { 'X-Preview': 'ONE_OFF_SECRET' } })
    await expect(withExecutionOwnership({ auditId: pending.id, taskId: task.id, token: 'original-worker', generation: 1 }, () =>
      executionWrite(tx => tx.audit.update({ where: { id: pending.id }, data: { errorMsg: 'STALE_WRITE' } })))).rejects.toBeInstanceOf(ExecutionOwnershipLost)
    await persistProjectScanAccess(site, owner, config('OLD_SECRET'))
    await expect(resolveAuditScanAccess(pending.id)).rejects.toMatchObject({ code: 'SCAN_ACCESS_CHANGED' })
    expect(decryptScanAccess((await prisma.audit.findUniqueOrThrow({ where: { id: completed.id } })).scanAccessEncrypted)).toEqual(config('OLD_SECRET'))
    // Independent fixture admissions are not consumed by the worker below.
    await prisma.audit.updateMany({ where: { id: { in: [publicAudit.id, oneOff.id] } }, data: { status: 'COMPLETED', completedAt: new Date() } })
  })
  it('uses current saved credentials through the real worker instead of the private parent snapshot', async () => {
    await persistProjectScanAccess(site, owner, config('PARENT_SECRET'))
    const parent = await savedAudit(await admitScanAccess(prisma, { projectId: site, userId: owner, targetUrl: url }), 'COMPLETED')
    await persistProjectScanAccess(site, owner, config('CURRENT_SECRET'))
    const flag = await prisma.flag.create({ data: { auditId: parent.id, checkId: 'keyboard-nav-trap', pageUrl: url,
      fingerprint: 'check:keyboard-nav-trap', source: 'DETERMINISTIC', rubric: 'EXPERIENCE', impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT', problem: 'Historical keyboard observation', evidence: 'Legacy fixture without native control scope',
      whyItMatters: 'Historical evidence remains separate from current access.', fix: 'Restore keyboard navigation', confidence: 0.9, position: 0 } })
    await materializeAttentionForAudit(parent.id)
    const original = pageSessions.createAuditPage, port = (server.address() as { port: number }).port
    const transport = vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, targetUrl, options) => original(browser, targetUrl, {
      ...options, configurePage: async page => {
        await page.route('https://example.com/**', async route => {
          const headers = await route.request().allHeaders()
          const response = await fetch('http://127.0.0.1:' + port, { headers: { 'X-Preview': headers['x-preview'] ?? '' } })
          await route.fulfill({ status: response.status, contentType: 'text/html', body: await response.text() })
        })
        await options.configurePage?.(page)
      },
    }))
    try {
    await getAuditBrowser()
    worker = startWorker()
    await worker.waitUntilReady()
    const fix = await recordSiteFlagFix({ siteId: site, flagId: flag.id, userId: owner, changeSummary: 'Recheck with current preview access' })
    const verified = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site, flagId: flag.id, userId: owner, attemptId: fix.attemptId,
      idempotencyKey: 'current-access', source: 'MCP' })
    if (!verified.ok || !('verificationAuditId' in verified) || !verified.verificationAuditId) throw new Error('Credential verification was not admitted')
    const child = { auditId: verified.verificationAuditId }
      try {
        await vi.waitFor(async () => {
          expect(await prisma.audit.findUnique({ where: { id: child.auditId } })).toMatchObject({ status: 'COMPLETED', improvementProjectedAt: expect.any(Date) })
        }, { timeout: 30_000, interval: 100 })
      } catch (error) {
        const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId: child.auditId, workKind: { not: null } },
          select: { workKind: true, workState: true, workErrorCode: true } })
        throw new Error('Worker did not finish: ' + JSON.stringify(tasks), { cause: error })
      }
      expect(observedToken).toBe('CURRENT_SECRET')
      expect(decryptScanAccess((await prisma.audit.findUniqueOrThrow({ where: { id: child.auditId } })).scanAccessEncrypted)).toEqual(config('CURRENT_SECRET'))
      expect((await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: child.auditId, workKind: 'keyboard' } })).workState).toBe('COMPLETED')

    } finally { transport.mockRestore() }
  }, 45_000)
})
