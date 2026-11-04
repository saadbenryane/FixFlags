import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { diffFlagsAgainstParent, getFlagDiffSummary, persistFlagDiffSummary } from '../diff-flags'
import { classifyWatchResult } from '../project-watch'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from './check-fixtures'
import { runPerformanceChecks } from '../checks/performance'
import { scopePerformanceAssertions } from '../performance-measurement'

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
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  async function performanceRunFixture(failingChild = true) {
    const url = 'https://example.com/', startedAt = Date.now() - 60_000
    const at = (seconds: number) => new Date(startedAt + seconds * 1000)
    const measurement = healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture(url) } })
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production', checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null }
    const parent = await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED', executionSpec: spec,
      reportCompleteness: 'FULL', createdAt: at(0), completedAt: at(1) } })
    const child = await prisma.audit.create({ data: { projectId, userId, url, parentId: parent.id, status: 'COMPLETED', executionSpec: spec,
      reportCompleteness: 'FULL', createdAt: at(2), completedAt: at(3) } })
    const proof = await prisma.audit.create({ data: { projectId, userId, url, parentId: child.id, status: 'COMPLETED', executionSpec: spec,
      reportCompleteness: 'FULL', createdAt: at(4), completedAt: at(5) } })
    const data = { ...runPerformanceChecks(measurement, null, url)[0], whyItMatters: 'Visitors wait for useful content', position: 0 }
    const original = await prisma.flag.create({ data: { ...data, auditId: parent.id, createdAt: at(1) } })
    const current = failingChild ? await prisma.flag.create({ data: { ...data, auditId: child.id, createdAt: at(3) } }) : null
    for (const audit of failingChild ? [proof] : [child, proof]) await prisma.auditVerificationReceipt.create({ data: {
      auditId: audit.id, targetKey: 'module:performance', scopeKey: 'page:' + url, pageUrl: url, source: 'DETERMINISTIC', status: 'COMPLETED',
      detail: { kind: 'site-module-check', version: 1, module: 'performance', pageUrl: url, applicable: true, passed: true,
        assertions: scopePerformanceAssertions(measurement, url, [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }]),
        execution: { auditId: audit.id, taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: audit.completedAt!.toISOString() } },
    } })
    return { parent, child, proof, original, current }
  }

  it.each(['OPEN', 'FIXED', 'REGRESSED', 'IGNORED'] as const)('compares the observed failure before a later native recovery without overwriting retained lifecycle (current=%s)', async status => {
    const { parent, child, proof, original, current } = await performanceRunFixture()
    await prisma.flag.update({ where: { id: original.id }, data: { status: 'FIXED', resolvedInId: proof.id } })
    await prisma.flag.update({ where: { id: current!.id }, data: { status, resolvedInId: status === 'FIXED' ? proof.id : null } })
    const saved = await prisma.flag.findMany({ where: { id: { in: [original.id, current!.id] } }, orderBy: { id: 'asc' } })
    const before = await getFlagDiffSummary(parent.id, child.id)
    expect(before).toMatchObject({ regressed: [], fixed: [], unchanged: [{ id: current!.id, status: 'OPEN' }] })
    await diffFlagsAgainstParent(child.id, parent.id)
    expect(await prisma.flag.findMany({ where: { id: { in: [original.id, current!.id] } }, orderBy: { id: 'asc' } })).toEqual(saved)
    await persistFlagDiffSummary(parent.id, child.id)
    expect(await getFlagDiffSummary(parent.id, child.id)).toEqual(before)
  })

  it.each(['recovery', 'growth', 'dismissal'] as const)('replans comparison when source %s commits between its evidence read and write', async change => {
    const { parent, child, proof, original } = await performanceRunFixture(false)
    const transaction = prisma.$transaction.bind(prisma)
    let changed = false, attempts = 0
    vi.spyOn(prisma, '$transaction').mockImplementation((async (body: (tx: unknown) => Promise<unknown>, options: unknown) => {
      attempts += 1
      return transaction(async tx => body(new Proxy(tx, { get(target, key) {
        if (key !== 'flag') return Reflect.get(target, key)
        return new Proxy(target.flag, { get(flags, method) {
          if (method !== 'update') return Reflect.get(flags, method)
          return async (args: Parameters<typeof flags.update>[0]) => {
            if (!changed && args.where.id === original.id) {
              changed = true
              await prisma.flag.update({ where: { id: original.id }, data: change === 'recovery'
                ? { status: 'FIXED', resolvedInId: proof.id } : change === 'dismissal' ? { status: 'IGNORED' }
                  : { affectedPaths: ['https://example.com/', 'https://example.com/later'] } })
            }
            return flags.update(args)
          }
        } })
      } })), options as never)
    }) as never)
    await diffFlagsAgainstParent(child.id, parent.id)
    expect(changed).toBe(true)
    expect(attempts).toBe(2)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject(change === 'recovery'
      ? { status: 'FIXED', resolvedInId: proof.id } : change === 'dismissal' ? { status: 'IGNORED', resolvedInId: null }
      : { status: 'OPEN', resolvedInId: null, affectedPaths: ['https://example.com/', 'https://example.com/later'] })
    const summary = await getFlagDiffSummary(parent.id, child.id)
    expect(summary).toMatchObject(change === 'recovery' ? { fixed: [{ id: original.id }] }
      : { fixed: [], inconclusive: change === 'growth' ? [{ id: original.id }] : [] })
  })

  it.each([{ peer: false, proven: true }, { peer: true, proven: true }, { peer: false, proven: false }])(
    'retains proven recovery and settles unproven sources during clear follow-up (proven=$proven, unresolved peer=$peer)', async ({ peer, proven }) => {
    const url = 'https://example.com/', measurement = healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture(url) } })
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production', checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null }
    const parent = await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED', executionSpec: spec, reportCompleteness: 'FULL', completedAt: new Date() } })
    async function clearAudit(record = true) {
      const audit = await prisma.audit.create({ data: { projectId, userId, url, parentId: parent.id, status: 'COMPLETED', executionSpec: spec,
        reportCompleteness: 'FULL', completedAt: new Date(), pages: { create: { url, normalizedUrl: url, position: 0, role: 'primary', status: 'COMPLETED', completeness: 'FULL' } } } })
      if (record) await prisma.auditVerificationReceipt.create({ data: { auditId: audit.id, targetKey: 'module:performance', scopeKey: 'page:' + url,
        pageUrl: url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: { kind: 'site-module-check', version: 1, module: 'performance',
          pageUrl: url, applicable: true, passed: true, assertions: scopePerformanceAssertions(measurement, url,
            [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }]),
          execution: { auditId: audit.id, taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: audit.completedAt!.toISOString() } } } })
      return audit
    }
    const proof = await clearAudit(proven)
    const data = { ...runPerformanceChecks(measurement, null, url)[0], auditId: parent.id,
      whyItMatters: 'Visitors wait for useful content', position: 0 }
    const recovered = await prisma.flag.create({ data: { ...data, status: 'FIXED', resolvedInId: proof.id } })
    const unresolved = peer ? await prisma.flag.create({ data: { ...data, position: 1 } }) : null
    const child = await clearAudit()
    await diffFlagsAgainstParent(child.id, parent.id)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: recovered.id } })).toEqual({ ...recovered, resolvedInId: proven ? proof.id : child.id })
    const summary = await getFlagDiffSummary(parent.id, child.id)
    expect(summary.fixed.map(flag => flag.id).toSorted()).toEqual([...(!proven ? [recovered.id] : []), ...(unresolved ? [unresolved.id] : [])].toSorted())
    if (unresolved) expect(await prisma.flag.findUniqueOrThrow({ where: { id: unresolved.id } })).toMatchObject({ status: 'FIXED', resolvedInId: child.id })
  })

  it.each(['recovery', 'severity'] as const)('preserves a %s regression across old per-page rows and a frozen summary', async cause => {
    // These are retained historical observations, not newly collected browser
    // evidence. Legacy page variants share the current Site-level identity.
    const startedAt = Date.now() - 60_000, at = (seconds: number) => new Date(startedAt + seconds * 1000)
    const parent = await prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/',
      status: 'COMPLETED', createdAt: at(0), completedAt: at(1), reportCompleteness: 'FULL' } })
    const child = await prisma.audit.create({ data: { projectId, userId, parentId: parent.id, url: parent.url,
      status: 'COMPLETED', createdAt: at(5), completedAt: at(6), reportCompleteness: 'FULL', recheckTrigger: 'WATCH' } })
    const stored = { auditId: parent.id, rubric: 'EXPERIENCE', severity: 'IMPORTANT' as const,
      source: 'DETERMINISTIC' as const, confidence: 1, position: 0, createdAt: at(1),
      problem: 'Primary action does not navigate', evidence: 'Retained public action observation.',
      whyItMatters: 'Visitors need to reach the intended destination.', fix: 'Restore the original public action destination.' }
    const ordinary = await prisma.flag.create({ data: { ...stored, checkId: 'cta-dead-link::page:1',
      pageUrl: 'https://example.com/first' } })
    const regressing = await prisma.flag.create({ data: { ...stored, checkId: 'cta-dead-link::page:2', position: 1,
      pageUrl: 'https://example.com/second', status: 'OPEN', resolvedInId: null,
      severity: cause === 'severity' ? 'POLISH' : 'IMPORTANT' } })
    if (cause === 'recovery') {
      const incident = await prisma.improvement.create({ data: { projectId, fingerprint: 'check:cta-dead-link', title: 'The retained action failure',
        judgment: 'Visitors cannot continue', expectedBenefit: 'Working navigation', recommendedChange: 'Restore the destination',
        successCondition: 'Recheck the original action', status: 'PROPOSED' } })
      await prisma.improvementOccurrence.create({ data: { improvementId: incident.id, auditId: parent.id, flagId: regressing.id, kind: 'OBSERVED', createdAt: at(1) } })
      const proof = await prisma.audit.create({ data: { projectId, userId, parentId: parent.id, url: parent.url, status: 'COMPLETED', createdAt: at(2), completedAt: at(3) } })
      await prisma.improvementAttempt.create({ data: { improvementId: incident.id, sourceAuditId: parent.id, verificationAuditId: proof.id,
        handoffReference: 'flag:' + regressing.id, builder: 'retained-legacy', outcome: 'IMPROVED', comparable: true, createdAt: at(2) } })
    }
    const current = await prisma.flag.create({ data: { ...stored, auditId: child.id, checkId: 'cta-dead-link', createdAt: at(6),
      pageUrl: regressing.pageUrl, affectedPaths: [ordinary.pageUrl!, regressing.pageUrl!] } })

    // Read before status projection too: notification classification cannot
    // depend on whether the Flag writer has already run.
    const before = await getFlagDiffSummary(parent.id, child.id)
    expect(before.regressed).toMatchObject([{ id: current.id, status: 'REGRESSED' }])
    expect(before.unchanged).toEqual([])
    await diffFlagsAgainstParent(child.id, parent.id)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: current.id } })).toMatchObject({ status: 'REGRESSED' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: regressing.id } })).toEqual(regressing)
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
    const subsequentlyRecovered = await prisma.flag.findUniqueOrThrow({ where: { id: current.id } })
    await diffFlagsAgainstParent(child.id, parent.id)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: current.id } })).toEqual(subsequentlyRecovered)
    expect(await getFlagDiffSummary(parent.id, child.id)).toEqual(frozen)
    await classifyWatchResult(parent.id, child.id)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: child.id } })).toMatchObject({
      watchRegressionCount: 1, watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0 })
    expect(await prisma.flag.count({ where: { auditId: { in: [parent.id, child.id] } } })).toBe(3)
  })
})
