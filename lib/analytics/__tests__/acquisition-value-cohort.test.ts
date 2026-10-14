import { describe, expect, it } from 'vitest'
import { calculateAcquisitionValueCohort, type AcquisitionAudit, type AcquisitionCycle, type AcquisitionStart } from '../acquisition-value-cohort'

const at = (day: number) => new Date(Date.UTC(2026, 9, 1) + day * 86_400_000)
const start = (id = 'private-source', day = 0): AcquisitionStart => ({
  idempotencyKey: `analyze_started:${id}`, properties: { anonymous: true, journeyId: 'private-journey' }, createdAt: at(day), userId: null, version: 1,
})
const audit = (overrides: Partial<AcquisitionAudit> = {}): AcquisitionAudit => ({
  id: 'private-source', source: 'ISSUE_PAGE', userId: 'private-owner', projectId: 'private-site', parentId: null,
  status: 'COMPLETED', createdAt: at(0), startedAt: at(0), completedAt: at(0.1),
  project: { id: 'private-site', userId: 'private-owner', deletedAt: null }, ...overrides,
})
const cycle = (): AcquisitionCycle => {
  const attempt = { id: 'private-attempt', sourceAuditId: 'private-source', improvementId: 'private-improvement', createdAt: at(2) }
  return { id: 'private-cycle', projectId: 'private-site', sourceAuditId: 'private-source', improvementId: 'private-improvement', createdAt: at(1),
    improvement: { projectId: 'private-site' },
    occurrence: { improvementId: 'private-improvement', auditId: 'private-source', flag: { auditId: 'private-source', createdAt: at(0.1) } },
    events: [
      { type: 'GENERATED', transport: 'SYSTEM', occurredAt: at(1), outcome: null, attemptId: null, verificationAuditId: null, attempt: null },
      { type: 'ATTEMPTED', transport: 'WEB', occurredAt: at(2), outcome: null, attemptId: attempt.id, verificationAuditId: null, attempt },
      { type: 'OUTCOME_ISSUED', transport: 'SYSTEM', occurredAt: at(3.2), outcome: 'IMPROVED', attemptId: attempt.id, verificationAuditId: 'private-after', attempt },
    ],
  }
}
const fixture = () => ({ starts: [start()], audits: [audit(), audit({ id: 'private-after', source: 'DASHBOARD', parentId: 'private-source', createdAt: at(3), startedAt: at(3), completedAt: at(3.1) })],
  results: [{ idempotencyKey: 'first_useful_result:private-source', createdAt: at(0.2) }],
  claims: [{ idempotencyKey: 'analysis_claimed:private-source', projectId: 'private-site', userId: 'private-owner', createdAt: at(1) }], cycles: [cycle()], since: at(0), now: at(10),
})

describe('exact-source anonymous acquisition value', () => {
  it('joins a mature start to its useful result, claim, repair and independent verification without identifiers', () => {
    const input = fixture(); input.starts.push(start()); input.cycles.push({ ...cycle(), id: 'another-cycle' })
    const report = calculateAcquisitionValueCohort(input)
    expect(report).toMatchObject({ status: 'available', followupDays: 7, databaseWritten: false,
      matureCohort: { starts: 1, usefulResultReceipts: 1, claimReceipts: 1, initialIssueCycles: 1,
        recordedFixAttempts: 1, issuedVerificationResults: 1, independentlyImproved: 1,
        observedSharesPct: { independentlyImproved: 100 } },
    })
    expect(report.surfaces[0].surface).toBe('ISSUE_PAGE')
    expect(JSON.stringify(report)).not.toContain('private-')
  })

  it('excludes seeds, follow-up and signed-in starts and holds immature starts out of rates', () => {
    const input = fixture()
    input.starts.push(start('seed'), start('followup'), start('recent', 9), { ...start('signed-in'), userId: 'owner', properties: { anonymous: false } })
    input.audits.push(audit({ id: 'seed', source: 'SEED' }), audit({ id: 'followup', parentId: 'parent' }), audit({ id: 'recent', createdAt: at(9) }))
    const report = calculateAcquisitionValueCohort(input)
    expect(report.coverage).toMatchObject({ recordedAnonymousStarts: 4, excludedSeedOrFollowupStarts: 2, immatureStarts: 1 })
    expect(report.matureCohort.starts).toBe(1)
  })

  it('preserves missing mature audits in the denominator and withholds percentages', () => {
    const input = fixture(); input.starts.push(start('missing'))
    const report = calculateAcquisitionValueCohort(input)
    expect(report.status).toBe('partial')
    expect(report.matureCohort.starts).toBe(2)
    expect(report.matureCohort.independentlyImproved).toBe(1)
    expect(report.matureCohort.observedSharesPct.independentlyImproved).toBeNull()
    expect(report.coverage.missingSourceAudits).toBe(1)
  })

  it('does not credit another source audit from the same Site or a standalone improvement event', () => {
    const input = fixture(); input.cycles[0].sourceAuditId = 'later-monitoring-audit'
    expect(calculateAcquisitionValueCohort(input).matureCohort.independentlyImproved).toBe(0)
    input.cycles = [cycle()]
    input.cycles[0].events = [{ ...input.cycles[0].events[2], type: 'IMPROVED' }]
    expect(calculateAcquisitionValueCohort(input).matureCohort.independentlyImproved).toBe(0)
  })

  it.each(['project', 'improvement-site', 'occurrence-target', 'attempt-source', 'attempt-improvement', 'verification-site', 'verification-owner', 'unfinished', 'self-reported', 'same-audit', 'reversed-dates'])('rejects unproven result lineage (%s)', (scenario) => {
    const input = fixture(); const event = input.cycles[0].events[2]
    if (scenario === 'project') input.cycles[0].projectId = 'other-site'
    if (scenario === 'improvement-site') input.cycles[0].improvement.projectId = 'other-site'
    if (scenario === 'occurrence-target') input.cycles[0].occurrence!.improvementId = 'other-improvement'
    if (scenario === 'attempt-source') event.attempt!.sourceAuditId = 'other-source'
    if (scenario === 'attempt-improvement') event.attempt!.improvementId = 'other-improvement'
    if (scenario === 'verification-site') input.audits[1].projectId = 'other-site'
    if (scenario === 'verification-owner') input.audits[1].userId = 'other-owner'
    if (scenario === 'unfinished') input.audits[1].status = 'RUNNING'
    if (scenario === 'self-reported') event.transport = 'WEB'
    if (scenario === 'same-audit') event.verificationAuditId = 'private-source'
    if (scenario === 'reversed-dates') input.audits[1].completedAt = at(1)
    const report = calculateAcquisitionValueCohort(input)
    expect(report.matureCohort.independentlyImproved).toBe(0)
    expect(report.status).toBe('partial')
  })

  it('keeps late actions outside the observation window without calling them invalid', () => {
    const input = fixture()
    input.results[0].createdAt = at(8)
    input.claims[0].createdAt = at(8)
    input.cycles[0].events[2].occurredAt = at(8)
    input.cycles.push({ ...cycle(), id: 'late', createdAt: at(8) })
    const report = calculateAcquisitionValueCohort(input)
    expect(report.status).toBe('partial')
    expect(report.matureCohort).toMatchObject({ starts: 1, usefulResultReceipts: 0, claimReceipts: 0, independentlyImproved: 0 })
    expect(report.coverage.currentlyOwnedWithoutClaimReceipt).toBe(1)
    expect(report.coverage.invalidCycleLineage).toBe(0)
    expect(report.matureCohort.observedSharesPct.claimReceipts).toBeNull()
    expect(report.matureCohort.observedSharesPct.independentlyImproved).toBe(0)
  })

  it('includes the exact seven-day boundary and distinguishes an empty cohort from a zero percent result', () => {
    const input = fixture(); input.cycles[0].events[2].occurredAt = at(7); input.now = at(7)
    expect(calculateAcquisitionValueCohort(input).matureCohort.independentlyImproved).toBe(1)
    input.starts = []
    expect(calculateAcquisitionValueCohort(input).matureCohort.observedSharesPct.independentlyImproved).toBeNull()
  })

  it('withholds owner-dependent outcomes after deletion or transfer without dropping the start', () => {
    const input = fixture(); input.audits[0].project!.deletedAt = at(5)
    expect(calculateAcquisitionValueCohort(input)).toMatchObject({ status: 'partial',
      matureCohort: { starts: 1, claimReceipts: 0, independentlyImproved: 0, observedSharesPct: { independentlyImproved: null } } })
    input.audits[0].project!.deletedAt = null; input.audits[0].project!.userId = 'new-owner'
    expect(calculateAcquisitionValueCohort(input).matureCohort.independentlyImproved).toBe(0)
  })

  it('exports only finite surface categories and never substitutes a Site-only claim receipt', () => {
    const input = fixture(); input.audits[0].source = 'private-campaign-or-url'; input.claims[0].idempotencyKey = 'site_claimed:private-owner:private-site'
    const report = calculateAcquisitionValueCohort(input)
    expect(report.surfaces[0].surface).toBe('UNKNOWN')
    expect(report.matureCohort.claimReceipts).toBe(0)
    expect(report.matureCohort.observedSharesPct.claimReceipts).toBeNull()
    expect(JSON.stringify(report)).not.toContain('private-')
  })

  it('requires the exact audit and owner for claim evidence even on the same Site', () => {
    const input = fixture(); input.claims[0].idempotencyKey = 'analysis_claimed:another-source'
    expect(calculateAcquisitionValueCohort(input).matureCohort.claimReceipts).toBe(0)
    input.claims[0].idempotencyKey = 'analysis_claimed:private-source'; input.claims[0].userId = 'other-owner'
    expect(calculateAcquisitionValueCohort(input).matureCohort.claimReceipts).toBe(0)
  })

  it('permits cycle bookkeeping to follow the recorded attempt without rewriting action time', () => {
    const input = fixture(); input.cycles[0].createdAt = at(2.1)
    input.cycles[0].events[0].occurredAt = at(2.1); input.cycles[0].events[1].occurredAt = at(2.2)
    expect(calculateAcquisitionValueCohort(input).matureCohort).toMatchObject({ recordedFixAttempts: 1, independentlyImproved: 1 })
  })
})
