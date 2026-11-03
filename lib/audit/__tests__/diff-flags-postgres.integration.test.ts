import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { diffFlagsAgainstParent, getFlagDiffSummary, persistFlagDiffSummary } from '../diff-flags'
import { classifyWatchResult } from '../project-watch'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('historical page conditions in monitoring comparisons', () => {
  let userId: string, projectId: string
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'flag-comparison-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const project = await prisma.project.create({ data: { userId, name: 'Historical comparison fixture',
      canonicalHost: 'example.com', url: 'https://example.com/', watchInterval: 'DAILY' } })
    projectId = project.id
  })
  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it.each(['recovery', 'severity'] as const)('preserves a %s regression across old per-page rows and a frozen summary', async cause => {
    // These are retained historical observations, not newly collected browser
    // evidence. Legacy page variants share the current Site-level identity.
    const parent = await prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/',
      status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'FULL' } })
    const child = await prisma.audit.create({ data: { projectId, userId, parentId: parent.id, url: parent.url,
      status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'FULL', recheckTrigger: 'WATCH' } })
    const stored = { auditId: parent.id, rubric: 'EXPERIENCE', severity: 'IMPORTANT' as const,
      source: 'DETERMINISTIC' as const, confidence: 1, position: 0,
      problem: 'Primary action does not navigate', evidence: 'Retained public action observation.',
      whyItMatters: 'Visitors need to reach the intended destination.', fix: 'Restore the original public action destination.' }
    const ordinary = await prisma.flag.create({ data: { ...stored, checkId: 'cta-dead-link::page:1',
      pageUrl: 'https://example.com/first' } })
    const regressing = await prisma.flag.create({ data: { ...stored, checkId: 'cta-dead-link::page:2', position: 1,
      pageUrl: 'https://example.com/second', status: cause === 'recovery' ? 'FIXED' : 'OPEN',
      resolvedInId: cause === 'recovery' ? 'retained-independent-recovery' : null,
      severity: cause === 'severity' ? 'POLISH' : 'IMPORTANT' } })
    const current = await prisma.flag.create({ data: { ...stored, auditId: child.id, checkId: 'cta-dead-link',
      pageUrl: regressing.pageUrl, affectedPaths: [ordinary.pageUrl!, regressing.pageUrl!] } })

    // Read before status projection too: notification classification cannot
    // depend on whether the Flag writer has already run.
    const before = await getFlagDiffSummary(parent.id, child.id)
    expect(before.regressed).toMatchObject([{ id: current.id, status: 'REGRESSED' }])
    expect(before.unchanged).toEqual([])
    await diffFlagsAgainstParent(child.id, parent.id)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: current.id } })).toMatchObject({ status: 'REGRESSED' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: regressing.id } })).toMatchObject({
      status: cause === 'recovery' ? 'FIXED' : 'REGRESSED', resolvedInId: regressing.resolvedInId,
      evidence: regressing.evidence, affectedPaths: regressing.affectedPaths })
    await persistFlagDiffSummary(parent.id, child.id)
    const frozen = await getFlagDiffSummary(parent.id, child.id)
    expect(frozen).toEqual(before)
    await classifyWatchResult(parent.id, child.id)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: child.id } })).toMatchObject({
      watchRegressionCount: 1, watchRecoveryCount: 0, watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0 })
    await diffFlagsAgainstParent(child.id, parent.id)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: current.id } })).toMatchObject({ status: 'REGRESSED' })

    // A later recovery can change the mutable row, but not the recorded report
    // or the summary body used by a delayed notification.
    await prisma.flag.update({ where: { id: current.id }, data: { status: 'FIXED', resolvedInId: 'later-recovery' } })
    expect(await getFlagDiffSummary(parent.id, child.id)).toEqual(frozen)
    await classifyWatchResult(parent.id, child.id)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: child.id } })).toMatchObject({
      watchRegressionCount: 1, watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0 })
    expect(await prisma.flag.count({ where: { auditId: { in: [parent.id, child.id] } } })).toBe(3)
  })
})
