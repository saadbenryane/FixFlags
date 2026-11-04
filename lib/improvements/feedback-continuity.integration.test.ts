import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { recordOwnerFlagFeedbackDecision } from './attempts'
import { recordFlagFeedback } from './feedback'
import * as intelligence from '@/lib/audit/product-intelligence'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('owner feedback and independently verified repair', () => {
  let owner: string, current: string, projectId: string, auditId: string, flagId: string
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    owner = (await prisma.user.create({ data: { email: randomUUID() + '@feedback-owner.test', role: 'admin' } })).id
    current = (await prisma.user.create({ data: { email: randomUUID() + '@feedback-current.test', role: 'admin' } })).id
    projectId = (await prisma.project.create({ data: { userId: owner, url: 'https://example.com/', canonicalHost: 'example.com',
      name: 'Feedback continuity', watchInterval: null } })).id
    auditId = (await prisma.audit.create({ data: { userId: owner, projectId, url: 'https://example.com/',
      status: 'COMPLETED', completedAt: new Date(), isPublic: false } })).id
    flagId = (await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', checkId: 'buttons-no-text', rubric: 'TRUST',
      severity: 'IMPORTANT', problem: 'The recorded button has no accessible name', evidence: 'The button has no name',
      whyItMatters: 'Its purpose cannot be identified', fix: 'Name the original button', confidence: 1, position: 0 } })).id
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.siteLifecycleEvent.deleteMany({ where: { userId: { in: [owner, current] } } })
    await prisma.audit.deleteMany({ where: { id: auditId } })
    await prisma.project.deleteMany({ where: { userId: { in: [owner, current] } } })
    await prisma.user.deleteMany({ where: { id: { in: [owner, current] } } })
  })
  async function history() {
    return Promise.all([
      prisma.flag.findUniqueOrThrow({ where: { id: flagId } }),
      prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
      prisma.improvement.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
      prisma.improvementOccurrence.findMany({ where: { auditId }, orderBy: { id: 'asc' } }),
      prisma.improvementAttempt.findMany({ where: { improvement: { projectId } }, orderBy: { id: 'asc' } }),
      prisma.improvementCycleEvent.findMany({ where: { cycle: { projectId } }, orderBy: { id: 'asc' } }),
    ])
  }

  it('retains an observed failure until an already-fixed assertion is independently checked', async () => {
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    const result = await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'already_fixed', note: 'Named the original button' })
    expect(result).toMatchObject({ action: 'READY_TO_VERIFY', attemptId: expect.any(String) })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toEqual(original)
    expect(await prisma.improvement.findFirstOrThrow({ where: { projectId } })).toMatchObject({ status: 'READY_TO_VERIFY' })
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: result.attemptId! } }))
      .toMatchObject({ verificationAuditId: null, outcome: null, changeSummary: 'Named the original button' })
  })

  it('rolls back the rejection and Flag projection if its intentional context cannot be recorded', async () => {
    const original = await history()
    vi.spyOn(intelligence, 'appendIntentionalNote').mockImplementationOnce(() => { throw new Error('Controlled context write failure') })
    await expect(recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'intentional', note: 'Keep this exception' }))
      .rejects.toThrow('Controlled context write failure')
    expect(await history()).toEqual(original)
  })

  it.each([false, true])('lets the current Site owner dismiss retained evidence with original actor erased=%s', async erased => {
    await prisma.project.update({ where: { id: projectId }, data: { userId: current, productIntelligence: {
      purpose: 'Known product purpose', firstValueJourney: 'Complete the original journey', criticalOutcomes: ['Checkout works'],
      constraints: ['Keep checkout stable'], knownRisks: ['Previously accepted risk'], source: 'user', updatedAt: new Date().toISOString(),
    } } })
    if (erased) await prisma.user.delete({ where: { id: owner } })
    const originalAudit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    await recordFlagFeedback({ flagId, userId: current, visitorToken: 'current-owner', vote: -1, dismiss: true,
      reason: 'low_priority', comment: 'Accepted during this migration' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'IGNORED' })
    expect(await prisma.improvement.findFirstOrThrow({ where: { projectId } }))
      .toMatchObject({ status: 'REJECTED', rejectionReason: 'LOW_IMPACT' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toEqual(originalAudit)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).productIntelligence)
      .toMatchObject({ purpose: 'Known product purpose', constraints: ['Keep checkout stable'], source: 'user',
        knownRisks: expect.arrayContaining(['Previously accepted risk', expect.stringContaining('Accepted during this migration')]) })
  })

  it('keeps a former creator vote separate from current owner decisions', async () => {
    await prisma.project.update({ where: { id: projectId }, data: { userId: current } })
    const original = await history()
    await expect(recordFlagFeedback({ flagId, userId: owner, visitorToken: 'former-owner', vote: -1, dismiss: true,
      reason: 'intentional' })).resolves.toMatchObject({ vote: -1 })
    expect(await history()).toEqual(original)
  })

  it('retains legacy unattached report repair under the active original creator', async () => {
    await prisma.audit.update({ where: { id: auditId }, data: { projectId: null } })
    const result = await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'already_fixed' })
    expect(result).toMatchObject({ productId: projectId, action: 'READY_TO_VERIFY', attemptId: expect.any(String) })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ projectId, userId: owner })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN' })
    expect(await prisma.project.count({ where: { userId: owner } })).toBe(1)
  })

  it('cannot reattach a report claimed by another Site after the initial decision read', async () => {
    await prisma.audit.update({ where: { id: auditId }, data: { projectId: null } })
    const nextSite = await prisma.project.create({ data: { userId: current, url: 'https://example.com/', canonicalHost: 'example.com', name: 'New owner' } })
    const originalProject = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const read = prisma.flag.findFirst.bind(prisma.flag)
    let claimed: unknown
    vi.spyOn(prisma.flag, 'findFirst').mockImplementationOnce(async args => {
      const result = await read(args)
      claimed = await prisma.audit.update({ where: { id: auditId }, data: { projectId: nextSite.id } })
      return result
    })
    await expect(recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'intentional' })).rejects.toMatchObject({ code: 'P2025' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toEqual(claimed)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(originalProject)
    expect(await prisma.improvement.count({ where: { projectId: { in: [projectId, nextSite.id] } } })).toBe(0)
  })
})
