import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteFlagDetail, loadSiteFlags, loadSiteResolvedFlags } from '../flags'
import { loadSiteRecord } from '../ensure-site'
import { loadSiteSummaries, loadSiteNotificationSummaries } from './list-sites'
import { loadAcceptedFlagRecoveries } from './accepted-flag-recoveries'
import { recordSiteFlagFix } from './flag-verification'
import { diffFlagsAgainstParent, getFlagDiffSummary } from '@/lib/audit/diff-flags'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('legacy recovery independent of displayed repair drafts', () => {
  let owner: string, projectId: string, otherProjectId: string, sourceId: string, proofId: string, flagId: string, incidentId: string, attemptId: string
  const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 0, minutes))
  async function source(auditId = sourceId, createdAt = at(1)) {
    const row = await prisma.flag.create({ data: { auditId, checkId: 'buttons-no-text', source: 'DETERMINISTIC', status: 'OPEN',
      rubric: 'TRUST', severity: 'CRITICAL', problem: 'The original control has no name', evidence: 'The observed button has no accessible name',
      whyItMatters: 'Its purpose cannot be identified', fix: 'Name the original control', fingerprint: 'check:buttons-no-text',
      pageUrl: 'https://example.com/', position: 0, confidence: 1, createdAt } })
    await prisma.improvementOccurrence.create({ data: { auditId, flagId: row.id, improvementId: incidentId, kind: 'OBSERVED', createdAt } })
    return row
  }
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    owner = (await prisma.user.create({ data: { email: randomUUID() + '@legacy-facts.test', role: 'admin' } })).id
    projectId = (await prisma.project.create({ data: { userId: owner, name: 'Legacy recovery', url: 'https://example.com/', canonicalHost: 'example.com' } })).id
    otherProjectId = (await prisma.project.create({ data: { userId: owner, name: 'Other Site', url: 'https://other.example/', canonicalHost: 'other.example' } })).id
    sourceId = (await prisma.audit.create({ data: { userId: owner, projectId, url: 'https://example.com/', status: 'COMPLETED', createdAt: at(0), completedAt: at(1) } })).id
    proofId = (await prisma.audit.create({ data: { userId: owner, projectId, url: 'https://example.com/', parentId: sourceId, status: 'COMPLETED', createdAt: at(3), completedAt: at(4) } })).id
    incidentId = (await prisma.improvement.create({ data: { projectId, fingerprint: 'check:buttons-no-text', status: 'VERIFIED', title: 'The original nameless control',
      judgment: 'Visitors cannot identify it', recommendedChange: 'Name the control', expectedBenefit: 'An identifiable control', successCondition: 'Independently check its name' } })).id
    flagId = (await source()).id
    attemptId = (await prisma.improvementAttempt.create({ data: { improvementId: incidentId, sourceAuditId: sourceId, verificationAuditId: proofId,
      builder: 'legacy-owner', outcome: 'IMPROVED', comparable: true, handoffReference: 'flag:' + flagId, createdAt: at(2) } })).id
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } })
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } })
    await prisma.user.deleteMany({ where: { id: owner } })
  })
  const target = () => ({ id: flagId, auditId: sourceId, improvementId: incidentId })
  async function replaceFixtureAttempt(handoffReference: string | null) {
    // Accepted intent is immutable. Seed a distinct retained record rather than
    // bypassing the database guard to alter an admitted fixture attempt.
    await prisma.improvementAttempt.delete({ where: { id: attemptId } })
    attemptId = (await prisma.improvementAttempt.create({ data: { improvementId: incidentId, sourceAuditId: sourceId, verificationAuditId: proofId,
      builder: 'legacy-owner', outcome: 'IMPROVED', comparable: true, handoffReference, createdAt: at(2) } })).id
  }

  it('retains independent recovery when a fresh repair declaration changes only the workflow', async () => {
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    const accepted = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    await recordSiteFlagFix({ siteId: projectId, userId: owner, flagId, idempotencyKey: 'new-attempt-after-recovery' })
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: incidentId } })).toMatchObject({ status: 'READY_TO_VERIFY' })
    const site = (await loadSiteRecord(projectId))!
    expect(await loadSiteFlags(site)).toEqual([])
    expect(await loadSiteFlagDetail(site, flagId)).toMatchObject({ status: 'VERIFIED', resolvedInId: proofId })
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ sourceFlagId: flagId, resolvedInId: proofId }])
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toEqual(original)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toEqual(accepted)
  })

  it.each(['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'READY_TO_VERIFY', 'UNVERIFIED', 'REJECTED', 'SUPERSEDED'] as const)(
    'retains the original certificate through %s workflow without certifying any peer', async status => {
      const peer = await source()
      await prisma.improvement.update({ where: { id: incidentId }, data: { status } })
      expect([...(await loadAcceptedFlagRecoveries(projectId, [target(), { ...target(), id: peer.id }])).keys()]).toEqual([flagId])
      const site = (await loadSiteRecord(projectId))!
      expect(await loadSiteFlagDetail(site, flagId)).toMatchObject({ status: 'VERIFIED', resolvedInId: proofId })
      expect(await loadSiteResolvedFlags(site)).toMatchObject([{ sourceFlagId: flagId, resolvedInId: proofId }])
    })

  it('requires a dated recovery before the compared observation when inferring incident recurrence', async () => {
    const inferred = { id: flagId, auditId: sourceId }
    expect((await loadAcceptedFlagRecoveries(projectId, [inferred], { before: at(3) })).size).toBe(0)
    expect((await loadAcceptedFlagRecoveries(projectId, [inferred], { before: at(4) })).get(flagId)?.auditId).toBe(proofId)
    await prisma.audit.update({ where: { id: proofId }, data: { completedAt: null } })
    expect((await loadAcceptedFlagRecoveries(projectId, [inferred], { before: at(10) })).size).toBe(0)
    expect((await loadAcceptedFlagRecoveries(projectId, [inferred])).get(flagId)).toEqual({ auditId: proofId, completedAt: null })
  })

  it('records a later observed failure as recurrence without retiring its original accepted proof', async () => {
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    await prisma.improvement.update({ where: { id: incidentId }, data: { status: 'PROPOSED' } })
    const later = await prisma.audit.create({ data: { projectId, userId: owner, parentId: sourceId, url: 'https://example.com/', status: 'COMPLETED',
      createdAt: at(10), completedAt: at(11), executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
        targetUrl: 'https://example.com/', environment: 'production', checks: { 'buttons-no-text': 1 }, outcomes: [], verificationTarget: null } } })
    const recurring = await source(later.id, at(11))
    await diffFlagsAgainstParent(later.id, sourceId)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: recurring.id } })).toMatchObject({ status: 'REGRESSED' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toEqual(original)
    expect((await getFlagDiffSummary(sourceId, later.id)).regressed).toMatchObject([{ id: recurring.id }])
    const site = (await loadSiteRecord(projectId))!
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: recurring.id, status: 'REGRESSED' }])
    expect(await loadSiteFlagDetail(site, flagId)).toMatchObject({ status: 'VERIFIED', resolvedInId: proofId })
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ sourceFlagId: flagId, resolvedInId: proofId }])
  })

  it('retains exact proof beyond twelve copied drafts while unresolved peers and recurrence remain current', async () => {
    const peer = await source()
    const later = await prisma.audit.create({ data: { userId: owner, projectId, url: 'https://example.com/', status: 'COMPLETED', createdAt: at(40), completedAt: at(41) } })
    const recurrence = await source(later.id, at(41))
    const artifact = 'Retained frozen source and editor guidance. '.repeat(25_000)
    await prisma.improvementAttempt.createMany({ data: Array.from({ length: 20 }, (_, index) => ({ improvementId: incidentId, sourceAuditId: sourceId,
      builder: 'copied-draft', handoffReference: 'flag:' + flagId, createdAt: at(10 + index), sourceObservations: { retainedArtifact: artifact } })) })
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } }), site = (await loadSiteRecord(projectId))!
    const current = await loadSiteFlags(site)
    expect(current).toMatchObject([{ sourceFlagId: recurrence.id }])
    const detail = await loadSiteFlagDetail(site, flagId)
    expect(detail).toMatchObject({ status: 'VERIFIED', resolvedInId: proofId, sourceFlagId: flagId, sourceFlagIds: [flagId] })
    expect(detail!.attempts).toHaveLength(12)
    expect(detail!.attempts.some(attempt => attempt.id === attemptId)).toBe(false)
    expect(await loadSiteFlagDetail(site, incidentId)).toMatchObject({ sourceFlagId: recurrence.id, sourceFlagIds: expect.arrayContaining([peer.id, recurrence.id]) })
    expect((await loadSiteSummaries(owner)).find(site => site.id === projectId)?.presentation.flags.count).toBe(1)
    expect((await loadSiteNotificationSummaries(owner)).find(site => site.id === projectId)?.notification.criticalCount).toBe(1)
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ sourceFlagId: flagId, resolvedInId: proofId, status: 'VERIFIED' }])
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toEqual(original)
    const transfers: unknown[][] = [], read = prisma.$queryRaw.bind(prisma) as (...args: unknown[]) => Promise<unknown[]>
    vi.spyOn(prisma, '$queryRaw').mockImplementation((async (...args: unknown[]) => {
      const rows = await read(...args); transfers.push(rows); return rows
    }) as never)
    expect((await loadAcceptedFlagRecoveries(projectId, [target()])).get(flagId)).toEqual({ auditId: proofId, completedAt: at(4) })
    expect(transfers).toHaveLength(1)
    expect(Buffer.byteLength(JSON.stringify(transfers))).toBeLessThan(2000)
  })

  it('looks past an unsupported snapshot certificate without transferring its frozen artifact', async () => {
    const later = await prisma.audit.create({ data: { userId: owner, projectId, parentId: sourceId, url: 'https://example.com/',
      status: 'COMPLETED', createdAt: at(10), completedAt: at(11) } })
    await prisma.improvementAttempt.create({ data: { improvementId: incidentId, sourceAuditId: sourceId, verificationAuditId: later.id,
      builder: 'snapshot-owner', outcome: 'IMPROVED', comparable: true, handoffReference: 'flag:' + flagId,
      sourceObservations: { retainedArtifact: 'Frozen source and editor guidance. '.repeat(25_000) }, createdAt: at(9) } })
    await prisma.improvement.update({ where: { id: incidentId }, data: { status: 'READY_TO_VERIFY' } })
    const transfers: unknown[][] = [], read = prisma.$queryRaw.bind(prisma) as (...args: unknown[]) => Promise<unknown[]>
    vi.spyOn(prisma, '$queryRaw').mockImplementation((async (...args: unknown[]) => {
      const rows = await read(...args); transfers.push(rows); return rows
    }) as never)
    expect((await loadAcceptedFlagRecoveries(projectId, [target()])).get(flagId)).toEqual({ auditId: proofId, completedAt: at(4) })
    expect(transfers).toHaveLength(2)
    expect(Buffer.byteLength(JSON.stringify(transfers))).toBeLessThan(3000)
    expect((await loadAcceptedFlagRecoveries(projectId, [{ ...target(), proofId: later.id }])).size).toBe(0)
    expect((await loadAcceptedFlagRecoveries(projectId, [{ ...target(), proofId }])).get(flagId)?.auditId).toBe(proofId)
  })

  it.each(['foreign', 'parent', 'failed', 'incomparable', 'unchanged', 'handoff', 'occurrence'] as const)('refuses %s recovery lineage in current findings, detail and history', async kind => {
    if (kind === 'foreign') await prisma.audit.update({ where: { id: proofId }, data: { projectId: otherProjectId } })
    if (kind === 'parent') await prisma.audit.update({ where: { id: proofId }, data: { parentId: null } })
    if (kind === 'failed') await prisma.audit.update({ where: { id: proofId }, data: { status: 'FAILED' } })
    if (kind === 'incomparable') await prisma.improvementAttempt.update({ where: { id: attemptId }, data: { comparable: false } })
    if (kind === 'unchanged') await prisma.improvementAttempt.update({ where: { id: attemptId }, data: { outcome: 'UNCHANGED' } })
    if (kind === 'handoff') await replaceFixtureAttempt('flag:another-capture')
    if (kind === 'occurrence') await prisma.improvementOccurrence.update({ where: { flagId }, data: { auditId: proofId } })
    expect((await loadAcceptedFlagRecoveries(projectId, [target()])).size).toBe(0)
    const site = (await loadSiteRecord(projectId))!
    expect(await loadSiteFlags(site)).toHaveLength(1)
    expect(await loadSiteFlagDetail(site, flagId)).toMatchObject({ status: 'OPEN', resolvedInId: null })
    expect(await loadSiteResolvedFlags(site)).toEqual([])
  })

  it('keeps an accepted missing recovery time unknown and refuses a caller-selected different proof', async () => {
    await prisma.audit.update({ where: { id: proofId }, data: { completedAt: null } })
    expect((await loadAcceptedFlagRecoveries(projectId, [target()])).get(flagId)).toEqual({ auditId: proofId, completedAt: null })
    expect((await loadAcceptedFlagRecoveries(projectId, [{ ...target(), proofId: sourceId }])).size).toBe(0)
    const site = (await loadSiteRecord(projectId))!
    expect(await loadSiteFlags(site)).toEqual([])
    expect(await loadSiteFlagDetail(site, flagId)).toMatchObject({ status: 'VERIFIED', resolvedInId: proofId })
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ sourceFlagId: flagId, latestOccurrenceAt: null }])
  })

  it('retains accepted same-Audit legacy scope across scalar batch boundaries', async () => {
    await replaceFixtureAttempt(null)
    const ids = Array.from({ length: 201 }, () => randomUUID())
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    await prisma.flag.createMany({ data: ids.map((id, position) => ({ id, auditId: sourceId, source: original.source, checkId: original.checkId,
      rubric: original.rubric, severity: original.severity, problem: original.problem, evidence: original.evidence,
      whyItMatters: original.whyItMatters, fix: original.fix, fingerprint: original.fingerprint, confidence: original.confidence, position })) })
    await prisma.improvementOccurrence.createMany({ data: ids.map(flagId => ({ flagId, auditId: sourceId, improvementId: incidentId, kind: 'OBSERVED' })) })
    expect((await loadAcceptedFlagRecoveries(projectId, ids.map(id => ({ ...target(), id })))).size).toBe(201)
  })

  it('retains accepted unbound fingerprint scope only while the Site still owns a consistent incident occurrence', async () => {
    await replaceFixtureAttempt(null)
    const peer = await source()
    await prisma.improvementOccurrence.delete({ where: { flagId: peer.id } })
    expect((await loadAcceptedFlagRecoveries(projectId, [{ ...target(), id: peer.id }])).get(peer.id)?.auditId).toBe(proofId)
    const site = (await loadSiteRecord(projectId))!
    expect(await loadSiteFlags(site)).toEqual([])
    await prisma.improvementOccurrence.delete({ where: { flagId } })
    expect((await loadAcceptedFlagRecoveries(projectId, [{ ...target(), id: peer.id }])).size).toBe(0)
    expect(await loadSiteFlags(site)).toHaveLength(1)
  })

  it.each(['REGRESSED', 'FIXED', 'IGNORED'] as const)('does not replace the retained %s source state with legacy workflow completion', async status => {
    await prisma.flag.update({ where: { id: flagId }, data: { status } })
    const before = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } }), site = (await loadSiteRecord(projectId))!
    expect((await loadAcceptedFlagRecoveries(projectId, [target()])).size).toBe(0)
    expect(await loadSiteFlagDetail(site, flagId)).toMatchObject({ status: status === 'FIXED' ? 'UNVERIFIED' : status })
    expect(await loadSiteFlags(site)).toHaveLength(status === 'IGNORED' ? 0 : 1)
    expect(await loadSiteResolvedFlags(site)).toEqual([])
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toEqual(before)
  })
})
