import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'
import { loadSiteFlags, loadSiteFlagDetail, loadSiteRepairBriefPage } from '../flags'
import { loadSiteSummaries } from './list-sites'
import { loadCurrentFindingSources } from './current-finding-sources'
import type { SiteRecord } from '../types'
import { unboundSiteFindingWhere } from './incident-proofs'
import { materializeAttentionForAudit } from '@/lib/improvements/occurrences'
import { ACCESSIBILITY_VERIFICATION_RULE } from '@/lib/audit/checks/accessibility-rules'
import { observationsForFlag } from '@/lib/audit/flag-observations'
import { loadSiteFlagCopyTask } from './flag-copy-task'
import { recordSiteFlagFix } from './flag-verification'
import { getAppUrl } from '@/lib/get-app-url'

// The former overview fetched this full presentation for historical sources
// before evaluating recovery. Keep that query as a local transfer reference.
const historicalPresentation = { id: true, auditId: true, createdAt: true, checkId: true, rubric: true, severity: true,
  impactTag: true, problem: true, evidence: true, whyItMatters: true, fix: true, pageUrl: true, status: true,
  resolvedInId: true, confidence: true, affectedPaths: true, fingerprint: true, verificationRule: true,
  supportingObservations: true, evidenceTargets: true, attentionPolicy: true } as const

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('current finding history with bounded PostgreSQL reads', () => {
  let owner: string, projectId: string, sourceId: string, recoveryId: string, incidentId: string
  let boundIds: string[], currentIds: string[], unboundId: string
  const url = 'https://example.com/'
  const measurement = healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture(url) } })
  const detected = runPerformanceChecks(measurement, null, url)[0]
  const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production', checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null }
  const at = (index: number) => new Date(Date.UTC(2026, 9, 1, 0, index))
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    owner = (await prisma.user.create({ data: { email: randomUUID() + '@finding-history.test' } })).id
    projectId = (await prisma.project.create({ data: { userId: owner, url, canonicalHost: 'example.com', name: 'Retained finding history' } })).id
    sourceId = (await prisma.audit.create({ data: { userId: owner, projectId, url, status: 'COMPLETED', completedAt: at(1), executionSpec: spec } })).id
    recoveryId = (await prisma.audit.create({ data: { userId: owner, projectId, url, status: 'COMPLETED', completedAt: at(400), executionSpec: spec } })).id
    await prisma.auditVerificationReceipt.create({ data: { auditId: recoveryId, targetKey: 'module:performance', scopeKey: 'page:' + url,
      pageUrl: url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: { kind: 'site-module-check', version: 1, module: 'performance',
        pageUrl: url, applicable: true, passed: true, assertions: scopePerformanceAssertions(measurement, url,
          [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }]),
        execution: { auditId: recoveryId, taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: at(400).toISOString() } } } })
    incidentId = (await prisma.improvement.create({ data: { projectId, fingerprint: 'history-performance', title: 'The original slow page',
      judgment: 'Visitors wait', expectedBenefit: 'Less waiting', recommendedChange: 'Retained original proposal. '.repeat(20_000),
      successCondition: 'Repeat the original measurement', status: 'PROPOSED' } })).id
    const nonce = randomUUID()
    boundIds = Array.from({ length: 263 }, (_, index) => nonce + '-bound-' + String(index).padStart(3, '0'))
    currentIds = boundIds.slice(-3)
    unboundId = nonce + '-unbound-original'
    const retained = 'Retained historical diagnosis. '.repeat(400)
    const flags = Array.from({ length: 260 }, (_, index) => ({ ...detected, id: boundIds[index], auditId: sourceId, source: 'DETERMINISTIC' as const,
      fingerprint: 'history-performance', position: index, createdAt: at(index), status: 'FIXED' as const, resolvedInId: recoveryId,
      evidence: retained, whyItMatters: retained, fix: retained }))
    await prisma.flag.createMany({ data: [...flags, ...currentIds.map((id, index) => ({ ...detected, id, auditId: sourceId,
      source: 'DETERMINISTIC' as const, fingerprint: 'history-performance', position: index + 260, createdAt: at(260 + index),
      status: index === 0 ? 'FIXED' as const : 'OPEN' as const, resolvedInId: null,
      problem: 'The original slow page ' + index, evidence: 'Original unresolved measurement ' + index, whyItMatters: 'Visitors wait' })),
    ...flags.map((flag, index) => ({ ...flag, id: nonce + '-unbound-' + index, fingerprint: 'unbound-history', position: index + 300 })),
    { ...detected, id: unboundId, auditId: sourceId, source: 'DETERMINISTIC', fingerprint: 'unbound-history', position: 600,
      status: 'OPEN', createdAt: at(-1), evidence: 'Original unbound slow observation', whyItMatters: 'Visitors wait' }] })
    await prisma.improvementOccurrence.createMany({ data: boundIds.map((flagId, index) => ({
      id: nonce + '-occurrence-' + String(index).padStart(3, '0'), improvementId: incidentId, auditId: sourceId, flagId,
      kind: 'OBSERVED', createdAt: at(index),
    })) })
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.user.deleteMany({ where: { id: owner } })
  })
  function site(): SiteRecord { return { kind: 'project', siteId: projectId, projectId, userId: owner, primaryAuditId: sourceId, url } as SiteRecord }

  it('uses both current review repairs for the board, paginated brief, copy and frozen repair scope', async () => {
    const checkId = 'form-inputs-no-label'
    const olderPage = url + 'contact', newerPage = url + 'plans'
    async function review(pageUrl: string, selector: string, fix: string, order: number) {
      const audit = await prisma.audit.create({ data: { projectId, userId: owner, url: pageUrl, status: 'COMPLETED',
        createdAt: at(order), completedAt: at(order + 1), executionSpec: { ...spec, targetUrl: pageUrl, checks: { [checkId]: 1 } } } })
      const finding = { checkId, source: 'DETERMINISTIC' as const, pageUrl,
        evidence: selector + ' has no accessible name', fix, verificationRule: ACCESSIBILITY_VERIFICATION_RULE,
        evidenceTargets: [{ kind: 'element' as const, source: 'measured' as const, device: 'desktop' as const,
          label: selector, selector, context: 'accessibility:axe:desktop:' + selector }],
      }
      const flag = await prisma.flag.create({ data: { ...finding, auditId: audit.id,
        createdAt: at(order + 1), fingerprint: 'check:' + checkId, rubric: 'EXPERIENCE', severity: 'IMPORTANT',
        problem: 'Control needs an accessible name', whyItMatters: 'People need the control name.', confidence: 1, position: 0,
        supportingObservations: observationsForFlag(finding, { auditId: audit.id, taskId: 'accessibility-' + order, checkVersion: 1 }) } })
      await materializeAttentionForAudit(audit.id)
      return flag
    }
    const older = await review(olderPage, '#email', 'Associate the email field with its label.', 500)
    const newer = await review(newerPage, '#plan', 'Name the plan selector.', 510)
    const current = (await loadSiteFlags(site())).find(flag => flag.checkId === checkId)!
    expect(current.sourceFlagId).toBe(newer.id)
    const incident = current.improvementId!
    expect(current.fix).toContain('For ' + olderPage + '\n' + older.fix)
    expect(current.fix).toContain('For ' + newerPage + '\n' + newer.fix)
    const copy = await loadSiteFlagCopyTask(site(), incident)
    const brief = await loadSiteRepairBriefPage(site(), incident, getAppUrl(), 0, copy.revision.contextHash)
    expect(brief?.repair.guidance).toBe(current.fix)
    expect(copy.prompt).toContain(older.fix)
    expect(copy.prompt).toContain(newer.fix)
    expect((await loadSiteFlagDetail(site(), newer.id))?.fix).toBe(newer.fix)

    await prisma.flag.update({ where: { id: older.id }, data: { fix: 'Use the visible Email label to name the field.' } })
    await expect(loadSiteRepairBriefPage(site(), incident, getAppUrl(), 0, copy.revision.contextHash))
      .rejects.toMatchObject({ code: 'REPAIR_CONTEXT_CHANGED' })
    const updated = await loadSiteFlagCopyTask(site(), incident)
    expect(updated.prompt).toContain('Use the visible Email label to name the field.')
    const declared = await recordSiteFlagFix({ siteId: projectId, flagId: incident, userId: owner,
      expectedContextHash: updated.revision.contextHash, idempotencyKey: 'cross-review-accessibility',
      changeSummary: 'Name both recorded controls' })
    const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } })
    expect(attempt.sourceFlagIds.toSorted()).toEqual([older.id, newer.id].sort())

    await prisma.flag.update({ where: { id: older.id }, data: { status: 'IGNORED' } })
    expect(await loadSiteFlagDetail(site(), incident)).toMatchObject({
      sourceFlagIds: [newer.id], affectedPaths: [newerPage], fix: newer.fix,
    })
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId }, select: { sourceFlagIds: true } }))
      .toEqual({ sourceFlagIds: attempt.sourceFlagIds })
  })

  it('retains unresolved sources while full recovered diagnoses stay outside current overview reads', async () => {
    const reference = await prisma.improvement.findMany({ where: { id: incidentId }, select: { id: true, status: true, fingerprint: true,
      outcome: { select: { id: true, name: true } }, occurrences: { orderBy: { createdAt: 'desc' },
        select: { createdAt: true, flag: { select: historicalPresentation } } } } })
    const unboundReference = await prisma.flag.findMany({ where: unboundSiteFindingWhere(projectId), select: historicalPresentation,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
    const original = await prisma.flag.findMany({ where: { auditId: sourceId }, orderBy: { id: 'asc' } })
    const referenceBytes = Buffer.byteLength(JSON.stringify(reference)) + Buffer.byteLength(JSON.stringify(unboundReference))
    const transfers: Array<{ rows: number; bytes: number }> = []
    for (const model of [prisma.improvement, prisma.improvementOccurrence, prisma.flag]) {
      const read = model.findMany.bind(model) as (...args: unknown[]) => Promise<unknown[]>
      vi.spyOn(model, 'findMany').mockImplementation((async (...args: unknown[]) => {
        const result = await read(...args)
        transfers.push({ rows: result.length, bytes: Buffer.byteLength(JSON.stringify(result)) })
        return result
      }) as never)
    }
    const findings = await loadSiteFlags(site())
    expect(findings.map(flag => flag.sourceFlagId)).toEqual(expect.arrayContaining([currentIds.at(-1), unboundId]))
    expect(findings).toHaveLength(2)
    expect(Math.max(...transfers.map(read => read.rows))).toBeLessThanOrEqual(128)
    const actualBytes = transfers.reduce((sum, read) => sum + read.bytes, 0)
    expect(actualBytes).toBeLessThan(referenceBytes / 10)
    console.info(JSON.stringify({ referenceBytes, actualBytes, maximumRows: Math.max(...transfers.map(read => read.rows)) }))
    vi.restoreAllMocks()
    expect((await loadSiteSummaries(owner))[0].presentation.flags.count).toBe(2)
    const detail = await loadSiteFlagDetail(site(), incidentId)
    expect(detail?.sourceFlagIds.toSorted()).toEqual(currentIds.toSorted())
    let historicalBytes = 0
    const read = prisma.flag.findFirst.bind(prisma.flag)
    vi.spyOn(prisma.flag, 'findFirst').mockImplementation(async args => {
      const result = await read(args)
      historicalBytes += Buffer.byteLength(JSON.stringify(result))
      return result
    })
    const historical = await loadSiteFlagDetail(site(), boundIds[0])
    expect(historical).toMatchObject({ sourceFlagId: boundIds[0], status: 'FIXED', sourceFlagIds: [boundIds[0]] })
    expect(historicalBytes).toBeLessThan(100_000)
    expect(await prisma.flag.findMany({ where: { auditId: sourceId }, orderBy: { id: 'asc' } })).toEqual(original)
  })

  it('does not cap a genuinely unresolved cohort at a history batch boundary', async () => {
    await prisma.flag.updateMany({ where: { id: { in: boundIds } }, data: { status: 'OPEN', resolvedInId: null } })
    const current = await loadCurrentFindingSources([projectId], [{ id: incidentId, projectId, status: 'PROPOSED' }])
    expect(current.byImprovement.get(incidentId)?.map(row => row.flag.id).toSorted()).toEqual(boundIds.toSorted())
    expect(current.unbound.get(projectId)?.map(row => row.id)).toEqual([unboundId])
  })

  it('uses recorded observation order consistently when an older source is linked later', async () => {
    await prisma.flag.update({ where: { id: currentIds[0] }, data: { severity: 'CRITICAL' } })
    await prisma.improvementOccurrence.update({ where: { flagId: currentIds[0] }, data: { createdAt: at(1000) } })
    const findings = await loadSiteFlags(site())
    expect(findings.find(flag => flag.improvementId === incidentId)).toMatchObject({ sourceFlagId: currentIds.at(-1), priorityBand: 'other' })
    expect((await loadSiteSummaries(owner))[0].presentation.flags.fixFirstCount).toBe(0)
    expect(await loadSiteFlagDetail(site(), incidentId)).toMatchObject({ sourceFlagId: currentIds.at(-1) })
  })

  it('shows only the current measured severity while retaining uncovered pages and exact historical records', async () => {
    const scoreSpec = { ...spec, checks: { 'perf-score-critical': 1, 'perf-score-poor': 1 } }
    const earlier = await prisma.audit.create({ data: { projectId, userId: owner, url, status: 'COMPLETED',
      createdAt: at(500), completedAt: at(501), executionSpec: scoreSpec } })
    const later = await prisma.audit.create({ data: { projectId, userId: owner, url, status: 'COMPLETED',
      createdAt: at(510), completedAt: at(511), executionSpec: scoreSpec } })
    async function source(auditId: string, pageUrl: string, score: number, position = 0) {
      const report = healthyDesktopPs({ score, diagnostics: { measurement: pageSpeedMeasurementFixture(pageUrl) } })
      const [flag] = runPerformanceChecks(report, null, pageUrl)
      return prisma.flag.create({ data: { ...flag, auditId, pageUrl, source: 'DETERMINISTIC', status: 'OPEN', position,
        createdAt: auditId === earlier.id ? at(520) : at(511), whyItMatters: 'Visitors wait for this page.' } })
    }
    const baselineCount = (await loadSiteSummaries(owner))[0].presentation.flags.count
    const critical = await source(earlier.id, url, 35)
    await materializeAttentionForAudit(earlier.id)
    const poor = await source(later.id, url, 65)
    await materializeAttentionForAudit(later.id)
    async function performanceFlags() { return (await loadSiteFlags(site())).filter(flag => flag.checkId?.startsWith('perf-score-')) }
    expect(await performanceFlags()).toMatchObject([{ sourceFlagId: poor.id, checkId: 'perf-score-poor' }])
    expect((await loadSiteSummaries(owner))[0].presentation.flags.count).toBe(baselineCount + 1)
    expect(await loadSiteFlagDetail(site(), critical.id)).toMatchObject({ sourceFlagId: critical.id, checkId: 'perf-score-critical' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: critical.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })

    const peer = await source(earlier.id, url + 'peer', 35, 1)
    await materializeAttentionForAudit(earlier.id)
    const current = await performanceFlags()
    expect(current.map(flag => flag.checkId).sort()).toEqual(['perf-score-critical', 'perf-score-poor'])
    const retained = current.find(flag => flag.checkId === 'perf-score-critical')!
    expect((await loadSiteFlagDetail(site(), retained.improvementId!))?.sourceFlagIds.toSorted()).toEqual([critical.id, peer.id].sort())
    expect((await loadSiteSummaries(owner))[0].presentation.flags.count).toBe(baselineCount + 2)
  })
})
