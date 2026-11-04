import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteFlagDetail, loadSiteFlags, loadSiteResolvedFlags } from '@/lib/sites/flags'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { recordOwnerFlagFeedbackDecision } from './attempts'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('retained already-fixed projection migration', () => {
  let owner: string, next: string, projectId: string, otherProjectId: string, sourceId: string, otherSourceId: string
  let flagId: string, incidentId: string, attemptId: string
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 0, minute))
  async function migrate() {
    return prisma.$executeRawUnsafe(await readFile(new URL('../../prisma/migrations/20261103230000_restore_declared_repair_attention/migration.sql', import.meta.url), 'utf8'))
  }
  async function snapshot() {
    return Promise.all([
      prisma.flag.findUniqueOrThrow({ where: { id: flagId } }),
      prisma.audit.findUniqueOrThrow({ where: { id: sourceId } }),
      prisma.improvement.findUniqueOrThrow({ where: { id: incidentId } }),
      prisma.improvementOccurrence.findMany({ where: { improvementId: incidentId }, orderBy: { id: 'asc' } }),
      prisma.improvementAttempt.findMany({ where: { improvementId: incidentId }, orderBy: { id: 'asc' } }),
      prisma.improvementCycle.findMany({ where: { improvementId: incidentId }, orderBy: { id: 'asc' } }),
      prisma.improvementCycleEvent.findMany({ where: { cycle: { improvementId: incidentId } }, orderBy: { id: 'asc' } }),
    ] as const)
  }
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    owner = (await prisma.user.create({ data: { email: randomUUID() + '@retained-declaration.test', role: 'admin' } })).id
    next = (await prisma.user.create({ data: { email: randomUUID() + '@retained-next.test', role: 'admin' } })).id
    projectId = (await prisma.project.create({ data: { userId: owner, name: 'Retained repair', url: 'https://example.com/', canonicalHost: 'example.com' } })).id
    otherProjectId = (await prisma.project.create({ data: { userId: next, name: 'Other Site', url: 'https://other.example/', canonicalHost: 'other.example' } })).id
    sourceId = (await prisma.audit.create({ data: { projectId, userId: owner, url: 'https://example.com/', status: 'COMPLETED', createdAt: at(0), completedAt: at(1) } })).id
    otherSourceId = (await prisma.audit.create({ data: { projectId: otherProjectId, userId: next, url: 'https://other.example/', status: 'COMPLETED' } })).id
    flagId = (await prisma.flag.create({ data: { auditId: sourceId, source: 'DETERMINISTIC', checkId: 'buttons-no-text', rubric: 'TRUST', severity: 'IMPORTANT',
      status: 'IGNORED', problem: 'The original button has no accessible name', evidence: 'The observed button has no name',
      whyItMatters: 'Visitors cannot identify the control', fix: 'Name the original control', pageUrl: 'https://example.com/',
      createdAt: at(1), position: 0, confidence: 1 } })).id
    incidentId = (await prisma.improvement.create({ data: { projectId, fingerprint: 'check:buttons-no-text', title: 'The original nameless button',
      judgment: 'Visitors cannot identify it', recommendedChange: 'Name the original control', expectedBenefit: 'An identifiable control',
      successCondition: 'Independently check its name', status: 'READY_TO_VERIFY' } })).id
    await prisma.improvementOccurrence.create({ data: { improvementId: incidentId, auditId: sourceId, flagId, kind: 'OBSERVED', createdAt: at(1) } })
    attemptId = (await prisma.improvementAttempt.create({ data: { improvementId: incidentId, sourceAuditId: sourceId, builder: 'user-decision',
      handoffReference: 'flag:' + flagId, changeSummary: 'Named the original control', createdAt: at(2) } })).id
  })
  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } })
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [owner, next] } } })
  })

  it.each(['OBSERVED', 'CONFIRMED', 'REGRESSED'] as const)('restores %s attention and preserves every retained record on retry', async kind => {
    await prisma.improvementOccurrence.update({ where: { flagId }, data: { kind } })
    const before = await snapshot(), site = (await loadSiteRecord(projectId))!
    // The retained source is currently hidden despite its recorded readiness.
    expect(await loadSiteFlags(site)).toEqual([])
    await migrate()
    const restored = kind === 'REGRESSED' ? 'REGRESSED' : 'OPEN'
    expect(await snapshot()).toEqual([{ ...before[0], status: restored }, ...before.slice(1)])
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: flagId }])
    expect(await loadSiteFlagDetail(site, flagId)).toMatchObject({ sourceFlagId: flagId, sourceAuditId: sourceId, verifying: false })
    expect((await loadSiteSummaries(owner))[0].presentation.flags.count).toBe(1)
    const after = await snapshot()
    await migrate()
    expect(await snapshot()).toEqual(after)
  })

  it.each(['REJECTED', 'SUPERSEDED', 'timestamp', 'reason', 'note', 'event'] as const)('retains an explicit %s decision even after another declaration', async marker => {
    if (marker === 'REJECTED' || marker === 'SUPERSEDED') await prisma.improvement.update({ where: { id: incidentId }, data: { status: marker } })
    if (marker === 'timestamp') await prisma.improvement.update({ where: { id: incidentId }, data: { rejectedAt: at(3) } })
    if (marker === 'reason') await prisma.improvement.update({ where: { id: incidentId }, data: { rejectionReason: 'MISUNDERSTOOD_PRODUCT_CONTEXT' } })
    if (marker === 'note') await prisma.improvement.update({ where: { id: incidentId }, data: { rejectionNote: 'Keep this exception' } })
    if (marker === 'event') {
      const cycle = await prisma.improvementCycle.create({ data: { projectId, improvementId: incidentId, sourceAuditId: sourceId } })
      await prisma.improvementCycleEvent.create({ data: { cycleId: cycle.id, idempotencyKey: 'retained-rejection', type: 'REJECTED', transport: 'web' } })
    }
    const before = await snapshot()
    await migrate()
    expect(await snapshot()).toEqual(before)
  })

  it.each(['builder', 'handoff', 'source', 'selection', 'occurrence', 'Site', 'unbound'] as const)('refuses ambiguous or inconsistent %s lineage', async kind => {
    if (kind === 'builder') await prisma.improvementAttempt.update({ where: { id: attemptId }, data: { builder: 'copied-task' } })
    if (kind === 'handoff') await prisma.improvementAttempt.update({ where: { id: attemptId }, data: { handoffReference: 'flag:another-capture' } })
    if (kind === 'source') await prisma.improvementAttempt.update({ where: { id: attemptId }, data: { sourceAuditId: otherSourceId } })
    if (kind === 'selection') await prisma.improvementAttempt.update({ where: { id: attemptId }, data: { sourceFlagIds: ['another-capture'] } })
    if (kind === 'occurrence') await prisma.improvementOccurrence.update({ where: { flagId }, data: { auditId: otherSourceId } })
    if (kind === 'Site') await prisma.improvement.update({ where: { id: incidentId }, data: { projectId: otherProjectId } })
    if (kind === 'unbound') await prisma.improvementOccurrence.delete({ where: { flagId } })
    const before = await snapshot()
    await migrate()
    expect(await snapshot()).toEqual(before)
  })

  it.each(['complete', 'failed', 'incomparable', 'foreign', 'parent'] as const)('retains the established %s verification conclusion without manufacturing recovery', async condition => {
    const proof = await prisma.audit.create({ data: { userId: owner, projectId: condition === 'foreign' ? otherProjectId : projectId,
      url: 'https://example.com/', parentId: condition === 'parent' ? otherSourceId : sourceId,
      status: condition === 'failed' ? 'FAILED' : 'COMPLETED', createdAt: at(3), completedAt: at(4) } })
    await prisma.improvement.update({ where: { id: incidentId }, data: { status: 'VERIFIED' } })
    await prisma.improvementAttempt.update({ where: { id: attemptId }, data: { outcome: 'IMPROVED', comparable: condition !== 'incomparable', verificationAuditId: proof.id } })
    if (condition === 'complete') await prisma.improvementAttempt.createMany({ data: Array.from({ length: 20 }, (_, index) => ({
      improvementId: incidentId, sourceAuditId: sourceId, builder: 'copied-draft', createdAt: at(10 + index),
    })) })
    const before = await snapshot()
    await migrate()
    expect(await snapshot()).toEqual([{ ...before[0], status: 'OPEN' }, ...before.slice(1)])
    const site = (await loadSiteRecord(projectId))!
    expect(await loadSiteFlags(site)).toHaveLength(condition === 'complete' ? 0 : 1)
    expect(await loadSiteResolvedFlags(site)).toHaveLength(condition === 'complete' ? 1 : 0)
  })

  it('retains an unproven former recovery as unverified instead of inventing a fresh failure', async () => {
    await prisma.improvementOccurrence.update({ where: { flagId }, data: { kind: 'CLEARED' } })
    const before = await snapshot()
    await migrate()
    expect(await snapshot()).toEqual([{ ...before[0], status: 'FIXED' }, ...before.slice(1)])
    const site = (await loadSiteRecord(projectId))!
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: flagId, status: 'UNVERIFIED' }])
    expect(await loadSiteResolvedFlags(site)).toEqual([])
  })

  it('retains source authorship after Site transfer and actor erasure', async () => {
    await prisma.project.update({ where: { id: projectId }, data: { userId: next } })
    await prisma.user.delete({ where: { id: owner } })
    const before = await snapshot()
    expect(before[1].userId).toBeNull()
    await migrate()
    expect(await snapshot()).toEqual([{ ...before[0], status: 'OPEN' }, ...before.slice(1)])
    expect((await loadSiteSummaries(next)).find(site => site.id === projectId)?.presentation.flags.count).toBe(1)
  })

  it('never replays the correction over a later explicit dismissal', async () => {
    await migrate()
    await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'intentional', note: 'Keep the later exception' })
    const dismissed = await snapshot()
    await migrate()
    expect(await snapshot()).toEqual(dismissed)
  })

  it('waits for an in-flight owner decision and then retains its committed dismissal', async () => {
    let unlock!: () => void, announce!: () => void
    const released = new Promise<void>(resolve => { unlock = resolve })
    const locked = new Promise<void>(resolve => { announce = resolve })
    const decision = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`
      announce()
      await released
      await tx.improvement.update({ where: { id: incidentId }, data: { status: 'REJECTED', rejectedAt: at(3), rejectionNote: 'The concurrent owner decision' } })
    }, { timeout: 15_000 })
    await locked
    const correction = migrate()
    try {
      await vi.waitFor(async () => {
        const [waiting] = await prisma.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()
            AND pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND query LIKE '%restore_declared_repair_attention%'`
        expect(waiting.count).toBe(1)
      }, { timeout: 5000, interval: 25 })
    } finally {
      unlock()
      await Promise.all([decision, correction])
    }
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'IGNORED' })
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: incidentId } })).toMatchObject({ status: 'REJECTED', rejectionNote: 'The concurrent owner decision' })
  })
})
