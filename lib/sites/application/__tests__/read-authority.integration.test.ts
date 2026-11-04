import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteCheckResultPage } from '../check-results'
import { loadMonitoringHistory } from '../monitoring-history'
import { listSiteOutcomes, loadSiteOutcomeDetails } from '../outcome-queries'
import { loadSiteBoardFlag, loadSiteHome } from '../queries'
import * as resultQueries from '../check-results'
import { loadSiteSummaries, loadSiteNotificationSummaries } from '../list-sites'
import { readSiteEvents } from '../execution-progress'
import { getOwnedRun } from '../run-queries'
import { serializeArtifact } from '@/lib/audit/progressive/contracts'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Site projection read authority', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterAll(() => prisma.$disconnect())

  it('binds an owned run to the requested Site and refuses another Site as its source', async () => {
    const identity = randomUUID(), users = []
    for (const kind of ['owner', 'stranger']) users.push(await prisma.user.create({ data: { email: kind + '-' + identity + '@run-scope.example' } }))
    try {
      const sites = []
      for (const [index, host] of ['first.example.com', 'second.example.com', 'private.example.com'].entries()) sites.push(await prisma.project.create({ data: {
        userId: users[index === 2 ? 1 : 0].id, name: host, canonicalHost: host, url: 'https://' + host + '/',
      } }))
      const spec = { version: 1, scope: 'OUTCOMES', targetUrl: sites[0].url, environment: 'production', checks: {}, outcomes: [], verificationTarget: null }
      const audit = await prisma.audit.create({ data: { projectId: sites[0].id, userId: users[0].id, url: sites[0].url,
        isPublic: false, status: 'COMPLETED', completedAt: new Date(), executionSpec: spec } })
      const foreign = await prisma.audit.create({ data: { projectId: sites[2].id, userId: users[1].id, url: sites[2].url,
        isPublic: false, status: 'COMPLETED', completedAt: new Date(), executionSpec: { ...spec, targetUrl: sites[2].url } } })
      const request = await prisma.runRequest.create({ data: { projectId: sites[0].id, auditId: audit.id, source: 'WEB',
        idempotencyKey: identity, status: 'COMPLETED', completedAt: new Date(), executionSpec: spec } })
      expect(await getOwnedRun(users[0].id, request.id, sites[0].id)).toMatchObject({ id: request.id, auditId: audit.id })
      expect(await getOwnedRun(users[0].id, request.id)).toMatchObject({ id: request.id })
      expect(await getOwnedRun(users[0].id, request.id, sites[1].id)).toBeNull()
      expect(await getOwnedRun(users[0].id, request.id, '')).toBeNull()
      expect(await getOwnedRun(users[1].id, request.id)).toBeNull()
      // Inconsistent retained links must remain unavailable, never lend another
      // Site's private source facts to an otherwise owned request.
      await prisma.runRequest.update({ where: { id: request.id }, data: { auditId: foreign.id } })
      expect(await getOwnedRun(users[0].id, request.id, sites[0].id)).toBeNull()
      expect(await getOwnedRun(users[0].id, request.id)).toBeNull()
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: foreign.id } })).toEqual(foreign)
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ auditId: foreign.id })
    } finally { await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } }) }
  })

  it.each((['run snapshot', 'account observation'] as const).flatMap(boundary => (['transfer', 'remove', 'suspend'] as const)
    .map(change => ({ boundary, change }))))('withholds a private run after $change during its $boundary read', async ({ boundary, change }) => {
    const identity = randomUUID(), userIds: string[] = []
    const owner = await prisma.user.create({ data: { email: 'run-owner-' + identity + '@read.example' } }); userIds.push(owner.id)
    const replacement = await prisma.user.create({ data: { email: 'run-next-' + identity + '@read.example' } }); userIds.push(replacement.id)
    try {
      const project = await prisma.project.create({ data: { userId: owner.id, name: 'Private run fixture', canonicalHost: 'example.com', url: 'https://example.com/' } })
      const spec = { version: 1, engine: 'progressive-v1', scope: 'ACCOUNT_CHECKS', targetUrl: project.url, environment: 'production',
        checks: {}, outcomes: [], verificationTarget: null, accountChecks: { revision: 1, mode: 'routine' } }
      const audit = await prisma.audit.create({ data: { projectId: project.id, userId: owner.id, url: project.url, isPublic: false,
        status: 'COMPLETED', completedAt: new Date(), executionSpec: spec } })
      const request = await prisma.runRequest.create({ data: { projectId: project.id, auditId: audit.id, source: 'WEB',
        idempotencyKey: identity, status: 'COMPLETED', completedAt: new Date(), executionSpec: spec } })
      // Stored private observations exercise publication authority, not real account behavior.
      const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:automatic-accounts',
        source: 'EXECUTION', status: 'COMPLETED', workKind: 'automatic-accounts', workState: 'COMPLETED',
        workResult: serializeArtifact('automatic-accounts', { observations: [{ kind: 'signed_in', state: 'failed',
          detail: 'Recorded private account failure', pageUrl: project.url, evidence: {} }] }) as never } })
      expect(await getOwnedRun(owner.id, request.id)).toMatchObject({ id: request.id, result: 'FLAG', scope: 'ACCOUNT_CHECKS' })
      const mutate = async () => {
        if (change === 'transfer') await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
        else if (change === 'remove') await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } })
        else await prisma.user.update({ where: { id: owner.id }, data: { lifecycleStatus: 'SUSPENDED' } })
      }
      const originalRun = prisma.runRequest.findFirst.bind(prisma.runRequest)
      const originalTask = prisma.auditExecutionTask.findFirst.bind(prisma.auditExecutionTask)
      const hook = boundary === 'run snapshot' ? vi.spyOn(prisma.runRequest, 'findFirst').mockImplementationOnce((async args => {
        const result = await originalRun(args); await mutate(); return result
      }) as typeof originalRun) : vi.spyOn(prisma.auditExecutionTask, 'findFirst').mockImplementationOnce((async args => {
        const result = await originalTask(args); await mutate(); return result
      }) as typeof originalTask)
      try { await expect(getOwnedRun(owner.id, request.id)).rejects.toMatchObject({ status: 404 }) }
      finally { hook.mockRestore() }
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toEqual(task)
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(request)
      if (change === 'remove') await prisma.project.update({ where: { id: project.id }, data: { deletedAt: null } })
      if (change === 'suspend') await prisma.user.update({ where: { id: owner.id }, data: { lifecycleStatus: 'ACTIVE' } })
      expect(await getOwnedRun(change === 'transfer' ? replacement.id : owner.id, request.id)).toMatchObject({ id: request.id, result: 'FLAG' })
    } finally { await prisma.user.deleteMany({ where: { id: { in: userIds } } }) }
  })

  it.each(['check page', 'counted check page', 'history', 'Outcome summaries', 'Outcome details', 'Site home', 'Flag detail', 'projection events'] as const)(
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
        const flag = reader === 'Flag detail' ? await prisma.flag.create({ data: { auditId: audit.id,
          source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT', problem: 'The title is missing',
          evidence: 'No title was recorded', whyItMatters: 'The page is difficult to identify', fix: 'Add a title',
          confidence: 1, position: 0, checkId: 'meta-title-missing', pageUrl: project.url } }) : null
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
          : reader === 'Flag detail' ? loadSiteBoardFlag(scope.siteId, flag!.id, scope)
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
        const originalFinding = prisma.journeyFinding.findFirst.bind(prisma.journeyFinding)
        const originalResults = resultQueries.loadSiteCheckResultPage
        const hook = reader === 'Site home' ? vi.spyOn(resultQueries, 'loadSiteCheckResultPage').mockImplementationOnce(async (...args) => {
          // The nested result guard has already returned. Holding connections
          // keeps the composed view pending until the real transfer commits.
          const result = await originalResults(...args)
          await transfer(); releaseConnection!(null); return result
        }) : reader === 'Flag detail' ? vi.spyOn(prisma.journeyFinding, 'findFirst').mockImplementationOnce((async args => {
          const result = await originalFinding(args); await transfer(); return result
        }) as typeof originalFinding) : reader === 'check page' ? vi.spyOn(prisma.auditVerifierExecution, 'findMany').mockImplementationOnce((async args => {
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
        else if (reader === 'Flag detail') expect(result).toMatchObject({ site: { userId: newOwner.id }, flag: { id: flag!.id } })
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
