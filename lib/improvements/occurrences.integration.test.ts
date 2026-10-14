import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as cycleLedger from './cycle-ledger'
import { materializeAttentionForAudit } from './occurrences'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('atomic Flag occurrence projection', () => {
  let userId: string, projectId: string, auditId: string
  beforeEach(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'projection-test-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', preferredTools: [] } })
    const project = await prisma.project.create({ data: { userId, name: 'Projection fixture', url: 'https://example.com/', canonicalHost: 'example.com' } })
    projectId = project.id
    const audit = await prisma.audit.create({ data: { userId, projectId, url: project.url, status: 'COMPLETED', completedAt: new Date(), isPublic: false } })
    auditId = audit.id
    for (const [position, status] of ['OPEN', 'OPEN', 'FIXED'].entries()) {
      await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', checkId: 'cta-dead-link', rubric: 'EXPERIENCE', severity: 'IMPORTANT', status: status as 'OPEN' | 'FIXED',
        problem: 'The action destination failed', evidence: 'Observed failed destination response', whyItMatters: 'Visitors cannot continue',
        fix: 'Restore the original destination', confidence: 1, position, pageUrl: `https://example.com/page-${position}` } })
    }
  })
  afterEach(async () => { vi.restoreAllMocks(); await prisma.user.delete({ where: { id: userId } }) })
  afterAll(async () => { await prisma.$disconnect() })

  it('retains every source identity and preserves cycle evidence on replay', async () => {
    await materializeAttentionForAudit(auditId)
    const improvement = await prisma.improvement.findMany({ where: { projectId } })
    expect(improvement).toHaveLength(1)
    const occurrences = await prisma.improvementOccurrence.findMany({ where: { auditId }, include: { flag: true } })
    expect(occurrences).toHaveLength(3)
    expect(occurrences.every(item => item.improvementId === improvement[0].id)).toBe(true)
    expect(occurrences.filter(item => item.kind === 'CLEARED')).toHaveLength(1)
    const events = await prisma.improvementCycleEvent.findMany({ where: { cycle: { projectId } }, orderBy: { id: 'asc' } })
    expect(events.map(item => item.idempotencyKey).sort()).toEqual(occurrences.map(item => `generated:${item.flagId}`).sort())
    await materializeAttentionForAudit(auditId)
    expect(await prisma.improvement.findMany({ where: { projectId }, select: { id: true } })).toEqual([{ id: improvement[0].id }])
    expect(await prisma.improvementOccurrence.count({ where: { auditId } })).toBe(3)
    expect(await prisma.improvementCycleEvent.findMany({ where: { cycle: { projectId } }, orderBy: { id: 'asc' } })).toEqual(events)
  })

  it('rolls back the Improvement and occurrences when cycle storage fails, then retries the full group', async () => {
    const interrupted = vi.spyOn(cycleLedger, 'appendImprovementCycleEvent').mockRejectedValueOnce(new Error('Cycle storage interrupted'))
    await expect(materializeAttentionForAudit(auditId)).rejects.toThrow('Cycle storage interrupted')
    expect(await prisma.improvement.count({ where: { projectId } })).toBe(0)
    expect(await prisma.improvementOccurrence.count({ where: { auditId } })).toBe(0)
    expect(await prisma.improvementCycle.count({ where: { projectId } })).toBe(0)
    interrupted.mockRestore()
    await materializeAttentionForAudit(auditId)
    expect(await prisma.improvement.count({ where: { projectId } })).toBe(1)
    expect(await prisma.improvementOccurrence.count({ where: { auditId } })).toBe(3)
    expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId } } })).toBe(3)
  })
})
