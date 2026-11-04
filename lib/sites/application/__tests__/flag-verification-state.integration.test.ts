import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadCurrentFlagVerifications } from '../flag-verification-state'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail, loadSiteFlags } from '@/lib/sites/flags'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('current admitted Flag verification', () => {
  let ownerId: string, projectId: string, sourceId: string, flagId: string, improvementId: string
  const observedAt = new Date('2026-11-01T00:00:00Z')
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    ownerId = 'verification-state-' + randomUUID()
    await prisma.user.create({ data: { id: ownerId, email: ownerId + '@example.test' } })
    projectId = (await prisma.project.create({ data: { userId: ownerId, canonicalHost: 'example.com', url: 'https://example.com/', name: 'Verification state' } })).id
    sourceId = (await prisma.audit.create({ data: { userId: ownerId, projectId, url: 'https://example.com/', status: 'COMPLETED', completedAt: observedAt } })).id
    flagId = (await prisma.flag.create({ data: { auditId: sourceId, checkId: 'title-missing', fingerprint: 'title',
      source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT', problem: 'Page title is missing', evidence: 'The captured title is empty.',
      whyItMatters: 'The page is difficult to identify.', fix: 'Add a descriptive title.', pageUrl: 'https://example.com/', confidence: 1, position: 0,
      createdAt: observedAt } })).id
    improvementId = (await prisma.improvement.create({ data: { projectId, fingerprint: 'title', title: 'Page title is missing',
      judgment: 'The title is empty.', expectedBenefit: 'Identify the page.', recommendedChange: 'Add its title.', successCondition: 'A title is captured.',
      status: 'READY_TO_VERIFY', occurrences: { create: { auditId: sourceId, flagId, kind: 'OBSERVED', createdAt: observedAt } } } })).id
  })
  afterEach(async () => { vi.restoreAllMocks(); await prisma.user.deleteMany({ where: { id: ownerId } }) })
  const targets = () => [{ id: flagId, auditId: sourceId, improvementId, createdAt: observedAt }]
  async function check(createdAt = new Date('2026-11-02T00:00:00Z'), parentId = sourceId) {
    const audit = await prisma.audit.create({ data: { userId: ownerId, projectId, parentId, url: 'https://example.com/', status: 'CHECKING', createdAt } })
    const attempt = await prisma.improvementAttempt.create({ data: { improvementId, sourceAuditId: sourceId, sourceFlagIds: [flagId],
      builder: 'CUSTOM', verificationAuditId: audit.id, handoffReference: 'flag:' + flagId, createdAt: observedAt } })
    return { audit, attempt }
  }

  it('keeps an admitted check visible beyond twelve newer copied tasks and retains the display history', async () => {
    const { audit, attempt } = await check()
    await prisma.improvementAttempt.createMany({ data: Array.from({ length: 20 }, (_, index) => ({ improvementId, sourceAuditId: sourceId,
      sourceFlagIds: [flagId], builder: 'CUSTOM', createdAt: new Date(observedAt.getTime() + 60_000 + index) })) })
    const site = (await loadSiteRecord(projectId))!
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: flagId, verificationState: 'verifying' }])
    const detail = (await loadSiteFlagDetail(site, flagId))!
    expect(detail).toMatchObject({ verifying: true, verificationState: 'verifying' })
    expect(detail.attempts).toHaveLength(12)
    expect(detail.attempts.some(row => row.id === attempt.id)).toBe(false)
    await prisma.audit.update({ where: { id: audit.id }, data: { status: 'COMPLETED', completedAt: new Date('2026-11-02T00:01:00Z') } })
    await prisma.improvementAttempt.update({ where: { id: attempt.id }, data: { outcome: 'UNCHANGED', comparable: true, verificationReason: 'native_failure' } })
    expect(await loadSiteFlagDetail(site, flagId)).toMatchObject({ verifying: false, verificationFeedback: { result: 'still_open' } })
    const recurrence = await prisma.audit.create({ data: { userId: ownerId, projectId, url: 'https://example.com/' } })
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    const laterFlag = await prisma.flag.create({ data: { auditId: recurrence.id, checkId: original.checkId,
      source: original.source, rubric: original.rubric, severity: original.severity, problem: original.problem,
      evidence: original.evidence, whyItMatters: original.whyItMatters, fix: original.fix, pageUrl: original.pageUrl,
      confidence: 1, position: 0, createdAt: new Date('2026-11-03T00:00:00Z') } })
    await prisma.improvementOccurrence.create({ data: { improvementId, auditId: recurrence.id, flagId: laterFlag.id,
      kind: 'REGRESSED', createdAt: laterFlag.createdAt } })
    expect(await loadSiteFlagDetail(site, flagId)).toMatchObject({ latestOccurrenceAt: observedAt.toISOString(),
      verificationFeedback: { result: 'still_open' } })
    expect(await prisma.improvementAttempt.count({ where: { improvementId } })).toBe(21)
  })

  it('orders actual checks independently of when their repair drafts were created', async () => {
    const earlier = await check(new Date('2026-11-02T00:00:00Z'))
    await prisma.audit.update({ where: { id: earlier.audit.id }, data: { status: 'FAILED', completedAt: new Date('2026-11-02T00:01:00Z') } })
    const later = await check(new Date('2026-11-03T00:00:00Z'))
    await prisma.improvementAttempt.update({ where: { id: later.attempt.id }, data: { createdAt: new Date('2026-10-31T00:00:00Z') } })
    expect((await loadCurrentFlagVerifications(projectId, targets())).get(flagId)).toEqual({ verifying: true, feedback: null })
    await prisma.audit.update({ where: { id: later.audit.id }, data: { status: 'FAILED', completedAt: new Date('2026-11-03T00:01:00Z') } })
    expect((await loadCurrentFlagVerifications(projectId, targets())).get(flagId))
      .toMatchObject({ verifying: false, feedback: { result: 'could_not_verify', checkedAt: '2026-11-03T00:01:00.000Z' } })
  })

  it('keeps pending finalization active and refuses unrelated parents, later occurrences and foreign Sites', async () => {
    const { audit } = await check()
    await prisma.audit.update({ where: { id: audit.id }, data: { status: 'COMPLETED', completedAt: new Date('2026-11-02T00:01:00Z') } })
    const finalizer = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:finalize', source: 'EXECUTION',
      workKind: 'finalize', workState: 'RETRY_WAIT', status: 'FAILED' } })
    expect((await loadCurrentFlagVerifications(projectId, targets())).get(flagId)?.verifying).toBe(true)
    await prisma.auditExecutionTask.update({ where: { id: finalizer.id }, data: { workState: 'COMPLETED', status: 'COMPLETED' } })
    expect((await loadCurrentFlagVerifications(projectId, targets())).get(flagId)?.verifying).toBe(false)
    const laterSource = await prisma.audit.create({ data: { userId: ownerId, projectId, url: 'https://example.com/' } })
    await prisma.audit.update({ where: { id: audit.id }, data: { parentId: laterSource.id, status: 'CHECKING' } })
    expect(await loadCurrentFlagVerifications(projectId, targets())).toEqual(new Map())
    await prisma.audit.update({ where: { id: audit.id }, data: { parentId: sourceId } })
    expect(await loadCurrentFlagVerifications('foreign-site', targets())).toEqual(new Map())
    expect(await loadCurrentFlagVerifications(projectId, [{ ...targets()[0], id: 'later-flag' }])).toEqual(new Map())
  })

  it('reads only scalar current state beside a large immutable comparison snapshot', async () => {
    const { attempt } = await check()
    await prisma.improvementAttempt.update({ where: { id: attempt.id }, data: { sourceObservations: { recorded: 'x'.repeat(2_000_000) } } })
    const read = vi.fn(prisma.$queryRaw.bind(prisma))
    expect((await loadCurrentFlagVerifications(projectId, targets(), { $queryRaw: read } as Pick<typeof prisma, '$queryRaw'>)).get(flagId)?.verifying).toBe(true)
    expect(Buffer.byteLength(JSON.stringify(await read.mock.results[0].value))).toBeLessThan(2000)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({ sourceObservations: { recorded: expect.any(String) } })
  })

  it('recognizes grouped captures from different source Audits without expanding a legacy single-Flag handoff', async () => {
    const { attempt } = await check()
    const peerSource = await prisma.audit.create({ data: { userId: ownerId, projectId, url: 'https://example.com/pricing' } })
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    const peer = await prisma.flag.create({ data: { auditId: peerSource.id, checkId: original.checkId,
      source: original.source, rubric: original.rubric, severity: original.severity, problem: original.problem,
      evidence: original.evidence, whyItMatters: original.whyItMatters, fix: original.fix, pageUrl: peerSource.url,
      confidence: 1, position: 0 } })
    const sameSourcePeer = await prisma.flag.create({ data: { auditId: sourceId, checkId: 'description-missing',
      source: original.source, rubric: original.rubric, severity: original.severity, problem: 'Description is missing',
      evidence: 'No description was captured.', whyItMatters: 'Identify the page.', fix: 'Add the description.', pageUrl: original.pageUrl,
      confidence: 1, position: 1 } })
    await prisma.improvementAttempt.update({ where: { id: attempt.id }, data: { sourceFlagIds: [flagId, peer.id] } })
    const selected = [...targets(), { id: peer.id, auditId: peerSource.id, improvementId },
      { id: sameSourcePeer.id, auditId: sourceId, improvementId }]
    const grouped = await loadCurrentFlagVerifications(projectId, selected)
    expect([...grouped.keys()].sort()).toEqual([flagId, peer.id].sort())
    expect([...grouped.values()].every(value => value.verifying)).toBe(true)
    await prisma.improvementAttempt.update({ where: { id: attempt.id }, data: { sourceFlagIds: [] } })
    expect([...(await loadCurrentFlagVerifications(projectId, selected)).keys()]).toEqual([flagId])
  })
})
