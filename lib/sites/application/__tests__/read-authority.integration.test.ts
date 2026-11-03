import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteCheckResultPage } from '../check-results'
import { loadMonitoringHistory } from '../monitoring-history'
import { listSiteOutcomes, loadSiteOutcomeDetails } from '../outcome-queries'
import { loadSiteHome } from '../queries'
import * as resultQueries from '../check-results'
import { loadSiteSummaries, loadSiteNotificationSummaries } from '../list-sites'
import { readSiteEvents } from '../execution-progress'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Site projection read authority', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterAll(() => prisma.$disconnect())

  it.each(['check page', 'counted check page', 'history', 'Outcome summaries', 'Outcome details', 'Site home', 'projection events'] as const)(
    'withholds %s after transfer during collection without losing the recorded evidence', async reader => {
      const identity = randomUUID(), now = new Date(), userIds: string[] = []
      const oldOwner = await prisma.user.create({ data: { email: 'old-' + identity + '@site-read.example' } })
      userIds.push(oldOwner.id)
      const newOwner = await prisma.user.create({ data: { email: 'new-' + identity + '@site-read.example' } })
      userIds.push(newOwner.id)
      try {
        const project = await prisma.project.create({ data: { userId: oldOwner.id, name: 'Private evidence fixture',
          canonicalHost: 'example.com', url: 'https://example.com/', accountChecksEnabled: false } })
        const audit = await prisma.audit.create({ data: { userId: oldOwner.id, projectId: project.id, url: project.url,
          status: 'COMPLETED', completedAt: now, executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
            targetUrl: project.url, environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
        const receipt = await prisma.auditVerificationReceipt.create({ data: { auditId: audit.id, targetKey: 'module:metadata',
          scopeKey: 'page:' + project.url, pageUrl: project.url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
            kind: 'site-module-check', version: 1, module: 'metadata', pageUrl: project.url, applicable: true, complete: true,
            passed: false, assertions: [{ key: 'title-presence', name: 'Page title', expected: 'A title is declared',
              observed: 'No title was recorded', passed: false, complete: true }],
          } } })
        const outcome = await prisma.siteOutcome.create({ data: { projectId: project.id, name: 'Page loads',
          slug: 'page-loads', kind: 'AVAILABILITY' } })
        const notice = reader === 'projection events' ? await prisma.auditPipelineEvent.create({ data: { auditId: audit.id,
          executionId: 'read-fixture', traceId: 'read-fixture', attempt: 1, stage: 'check', event: 'projection_changed', status: 'COMPLETED',
          detail: { version: 1, kind: 'http', state: 'COMPLETED', taskId: 'read-fixture' } } }) : null
        const site = (await loadSiteRecord(project.id))!
        let releaseConnection: ((value: null) => void) | undefined
        const connections = reader === 'Site home' ? new Promise<null>(resolve => { releaseConnection = resolve }) : Promise.resolve(null)
        const read = (scope = site) => reader === 'check page' || reader === 'counted check page'
          ? loadSiteCheckResultPage(scope, audit, undefined, new Map(), {}, reader === 'counted check page')
          : reader === 'history' ? loadMonitoringHistory(scope)
          : reader === 'Site home' ? loadSiteHome(scope.siteId, { site: scope, connections })
          : reader === 'projection events' ? readSiteEvents(scope, BigInt(0))
          : reader === 'Outcome summaries' ? listSiteOutcomes(scope) : loadSiteOutcomeDetails(scope)
        const transfer = () => prisma.project.update({ where: { id: project.id }, data: { userId: newOwner.id } })
        // Commit the real ownership change after the selected source read. The
        // counted path finishes its database snapshot before the owner changes.
        const originalReceipts = prisma.auditVerifierExecution.findMany.bind(prisma.auditVerifierExecution)
        const originalAudits = prisma.audit.findMany.bind(prisma.audit)
        const originalOutcomes = prisma.siteOutcome.findMany.bind(prisma.siteOutcome)
        const originalTransaction = prisma.$transaction.bind(prisma)
        const originalEvents = prisma.auditPipelineEvent.findMany.bind(prisma.auditPipelineEvent)
        const originalResults = resultQueries.loadSiteCheckResultPage
        const hook = reader === 'Site home' ? vi.spyOn(resultQueries, 'loadSiteCheckResultPage').mockImplementationOnce(async (...args) => {
          // The nested result guard has already returned. Holding connections
          // keeps the composed view pending until the real transfer commits.
          const result = await originalResults(...args)
          await transfer(); releaseConnection!(null); return result
        }) : reader === 'check page' ? vi.spyOn(prisma.auditVerifierExecution, 'findMany').mockImplementationOnce((async args => {
          const rows = await originalReceipts(args); await transfer(); return rows
        }) as typeof originalReceipts) : reader === 'counted check page' ? vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (...args: Parameters<typeof originalTransaction>) => {
          const result = await originalTransaction(...args); await transfer(); return result
        }) as typeof originalTransaction) : reader === 'history' ? vi.spyOn(prisma.audit, 'findMany').mockImplementationOnce((async args => {
          const rows = await originalAudits(args); await transfer(); return rows
        }) as typeof originalAudits) : reader === 'projection events' ? vi.spyOn(prisma.auditPipelineEvent, 'findMany').mockImplementationOnce((async args => {
          const rows = await originalEvents(args); await transfer(); return rows
        }) as typeof originalEvents) : vi.spyOn(prisma.siteOutcome, 'findMany').mockImplementationOnce((async args => {
          const rows = await originalOutcomes(args); await transfer(); return rows
        }) as typeof originalOutcomes)
        try { await expect(read()).rejects.toMatchObject({ status: 404 }) }
        finally { hook.mockRestore() }
        await expect(read()).rejects.toMatchObject({ status: 404 })
        const current = (await loadSiteRecord(project.id))!
        expect(current.userId).toBe(newOwner.id)
        const result = await read(current)
        if (reader === 'check page' || reader === 'counted check page') expect(result).toMatchObject({
          results: expect.arrayContaining([expect.objectContaining({ auditId: audit.id,
            evidenceReference: expect.objectContaining({ executionId: receipt.id }) })]),
        })
        else if (reader === 'history') expect(result).toMatchObject({ timeline: [expect.objectContaining({ id: audit.id })] })
        else if (reader === 'Site home') expect(result).toMatchObject({ site: { userId: newOwner.id }, audit: { id: audit.id } })
        else if (reader === 'projection events') expect(result).toEqual([expect.objectContaining({ sequence: notice!.sequence, auditId: audit.id })])
        else expect(result).toEqual([expect.objectContaining({ id: outcome.id })])
        expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(receipt)
      } finally { await prisma.user.deleteMany({ where: { id: { in: userIds } } }) }
    })
  it.each((['website', 'notification'] as const).flatMap(reader => (['transfer', 'remove', 'suspend'] as const)
    .map(change => ({ reader, change }))))('omits unauthorized $reader summaries after $change during collection', async ({ reader, change }) => {
    const identity = randomUUID(), userIds: string[] = []
    const owner = await prisma.user.create({ data: { email: 'owner-' + identity + '@summary-read.example' } })
    userIds.push(owner.id)
    const replacement = await prisma.user.create({ data: { email: 'next-' + identity + '@summary-read.example' } })
    userIds.push(replacement.id)
    try {
      const project = await prisma.project.create({ data: { userId: owner.id, name: 'Private Site', canonicalHost: 'example.com', url: 'https://example.com/' } })
      const peer = await prisma.project.create({ data: { userId: owner.id, name: 'Retained Site', canonicalHost: 'peer.example', url: 'https://peer.example/' } })
      await prisma.audit.create({ data: { userId: owner.id, projectId: project.id, url: project.url, status: 'COMPLETED', completedAt: new Date(),
        executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: project.url, environment: 'production',
          checks: {}, outcomes: [], verificationTarget: null } } })
      const read = reader === 'website' ? loadSiteSummaries : loadSiteNotificationSummaries
      expect((await read(owner.id)).map(row => row.id).sort()).toEqual([project.id, peer.id].sort())
      const original = prisma.audit.findMany.bind(prisma.audit)
      const hook = vi.spyOn(prisma.audit, 'findMany').mockImplementationOnce((async args => {
        const rows = await original(args)
        if (change === 'transfer') await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
        else if (change === 'remove') await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } })
        else await prisma.user.update({ where: { id: owner.id }, data: { lifecycleStatus: 'SUSPENDED' } })
        return rows
      }) as typeof original)
      try { expect((await read(owner.id)).map(row => row.id)).toEqual(change === 'suspend' ? [] : [peer.id]) }
      finally { hook.mockRestore() }
      expect(await prisma.audit.count({ where: { projectId: project.id } })).toBe(1)
      if (change === 'remove') await prisma.project.update({ where: { id: project.id }, data: { deletedAt: null } })
      if (change === 'suspend') await prisma.user.update({ where: { id: owner.id }, data: { lifecycleStatus: 'ACTIVE' } })
      expect((await read(change === 'transfer' ? replacement.id : owner.id)).map(row => row.id)).toContain(project.id)
    } finally { await prisma.user.deleteMany({ where: { id: { in: userIds } } }) }
  })
})
