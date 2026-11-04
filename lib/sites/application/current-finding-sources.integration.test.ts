import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'
import { loadSiteFlags, loadSiteFlagDetail } from '../flags'
import { loadSiteSummaries } from './list-sites'
import { loadCurrentFindingSources } from './current-finding-sources'
import type { SiteRecord } from '../types'
import { unboundSiteFindingWhere } from './incident-proofs'

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
  function site(): SiteRecord { return { kind: 'project', projectId, userId: owner, primaryAuditId: sourceId, url } as SiteRecord }

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
})
