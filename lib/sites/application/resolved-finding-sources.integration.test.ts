import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'
import { loadSiteFlags, loadSiteResolvedFlags } from '../flags'
import { loadIncidentRecoveryProofs } from './incident-proofs'
import type { SiteRecord } from '../types'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('recent independently proven Site recoveries', () => {
  let owner: string, projectId: string, sourceId: string, proofId: string
  const url = 'https://example.com/'
  const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 0, minutes))
  const measurement = healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture(url) } })
  const detected = runPerformanceChecks(measurement, null, url)[0]
  const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production',
    checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null }
  async function proof(minutes: number) {
    const audit = await prisma.audit.create({ data: { userId: owner, projectId, url, parentId: sourceId,
      status: 'COMPLETED', createdAt: at(minutes - 1), completedAt: at(minutes), executionSpec: spec } })
    await prisma.auditVerificationReceipt.create({ data: { auditId: audit.id, targetKey: 'module:performance', scopeKey: 'page:' + url,
      source: 'DETERMINISTIC', status: 'COMPLETED', pageUrl: url, detail: { kind: 'site-module-check', version: 1, module: 'performance',
        pageUrl: url, applicable: true, passed: true, assertions: scopePerformanceAssertions(measurement, url,
          [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }]),
        execution: { auditId: audit.id, taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: at(minutes).toISOString() } } } })
    return audit.id
  }
  async function incident(status: 'PROPOSED' | 'VERIFIED' = 'PROPOSED') {
    return prisma.improvement.create({ data: { projectId, fingerprint: randomUUID(), title: 'The original slow page', judgment: 'Visitors wait',
      expectedBenefit: 'Less waiting', recommendedChange: 'Inspect the measured resource', successCondition: 'Repeat the original measurement', status } })
  }
  async function flag(improvementId?: string, minutes = 1, resolvedInId: string | null = proofId, auditId = sourceId) {
    const row = await prisma.flag.create({ data: { ...detected, whyItMatters: 'Visitors wait for main content', auditId,
      source: 'DETERMINISTIC', pageUrl: url, affectedPaths: [url], createdAt: at(minutes),
      status: resolvedInId ? 'FIXED' : 'OPEN', resolvedInId, position: minutes } })
    if (improvementId) await prisma.improvementOccurrence.create({ data: { improvementId, auditId, flagId: row.id, kind: 'OBSERVED', createdAt: at(minutes) } })
    return row
  }
  function site(): SiteRecord { return { kind: 'project', projectId, userId: owner, primaryAuditId: sourceId, url } as SiteRecord }
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    owner = (await prisma.user.create({ data: { email: randomUUID() + '@resolved-history.test' } })).id
    projectId = (await prisma.project.create({ data: { userId: owner, url, canonicalHost: 'example.com', name: 'Retained recoveries' } })).id
    sourceId = (await prisma.audit.create({ data: { userId: owner, projectId, url, status: 'COMPLETED', createdAt: at(0), completedAt: at(0), executionSpec: spec } })).id
    proofId = await proof(100)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.user.deleteMany({ where: { id: owner } })
  })

  it('uses all original native comparison inputs and retains the actual affected paths', async () => {
    const improvement = await incident()
    const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Main content appears', slug: 'main-content' } })
    await prisma.improvement.update({ where: { id: improvement.id }, data: { outcomeId: outcome.id } })
    const row = await flag(improvement.id)
    const proofs = (await loadIncidentRecoveryProofs([{ projectId, flags: [row] }])).get(projectId)
    expect(proofs?.hasFlag(row)).toBe(true)
    expect(await loadSiteFlags(site())).toEqual([])
    expect(await loadSiteResolvedFlags(site())).toMatchObject([{ id: improvement.id, sourceFlagId: row.id, status: 'FIXED',
      latestOccurrenceAt: at(100).toISOString(), affectedPaths: [url], relatedOutcome: { id: outcome.id, name: outcome.name } }])
    expect(await loadSiteResolvedFlags(site())).toHaveLength(1)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: row.id } })).toEqual(row)
  })

  it('cannot report native recovery after the original comparison profile changes', async () => {
    const row = await flag()
    const targets = JSON.parse(JSON.stringify(row.evidenceTargets)) as Array<{ context: string }>
    targets[0].context = targets[0].context.replace(/:[a-f0-9]{64}:/, ':' + '0'.repeat(64) + ':')
    const changed = await prisma.flag.update({ where: { id: row.id }, data: { evidenceTargets: targets } })
    expect((await loadIncidentRecoveryProofs([{ projectId, flags: [changed] }])).get(projectId)?.hasFlag(changed)).not.toBe(true)
    expect(await loadSiteResolvedFlags(site())).toEqual([])
  })

  it('shows a recently repaired longstanding incident beyond repeated newer source captures', async () => {
    const repeated = await incident(), longstanding = await incident()
    for (let index = 0; index < 55; index++) await flag(repeated.id, index + 10)
    const original = await flag(longstanding.id, 1, await proof(200))
    const recovered = await loadSiteResolvedFlags(site())
    expect(recovered).toHaveLength(2)
    expect(recovered[0]).toMatchObject({ id: longstanding.id, sourceFlagId: original.id, latestOccurrenceAt: at(200).toISOString() })
  })

  it.each([false, true])('dates an accepted legacy recovery from verification, with missing completion=%s', async undated => {
    const improvement = await incident('VERIFIED')
    const original = await flag(improvement.id, 1, null)
    await prisma.flag.update({ where: { id: original.id }, data: { affectedPaths: [url, url + 'pricing'] } })
    if (undated) await prisma.audit.update({ where: { id: proofId }, data: { completedAt: null } })
    await prisma.improvementAttempt.create({ data: { improvementId: improvement.id, sourceAuditId: sourceId, verificationAuditId: proofId,
      builder: 'legacy-owner', createdAt: at(10), outcome: 'IMPROVED', comparable: true, handoffReference: 'flag:' + original.id } })
    expect(await loadSiteResolvedFlags(site())).toMatchObject([{ id: improvement.id, sourceFlagId: original.id, status: 'VERIFIED',
      latestOccurrenceAt: undated ? null : at(100).toISOString(), affectedPaths: [url, url + 'pricing'] }])
  })

  it.each(['foreign', 'missing-measurement'] as const)('refuses %s completion as proof of recovery', async kind => {
    const row = await flag((await incident()).id)
    if (kind === 'foreign') {
      const other = await prisma.project.create({ data: { userId: owner, name: 'Other Site', url: 'https://other.example.com/', canonicalHost: 'other.example.com' } })
      await prisma.audit.update({ where: { id: proofId }, data: { projectId: other.id } })
    } else await prisma.auditVerificationReceipt.deleteMany({ where: { auditId: proofId } })
    expect(await loadSiteResolvedFlags(site())).toEqual([])
    expect(await loadSiteFlags(site())).toMatchObject([{ sourceFlagId: row.id, status: 'UNVERIFIED' }])
  })

  it('keeps a later occurrence open while showing the accepted legacy repair of its exact original', async () => {
    const improvement = await incident('VERIFIED')
    const original = await flag(improvement.id, 1, null)
    const laterAudit = await prisma.audit.create({ data: { userId: owner, projectId, url, status: 'COMPLETED', completedAt: at(101), executionSpec: spec } })
    const later = await flag(improvement.id, 101, null, laterAudit.id)
    await prisma.improvementAttempt.create({ data: { improvementId: improvement.id, sourceAuditId: sourceId, verificationAuditId: proofId,
      builder: 'legacy-owner', createdAt: at(10), outcome: 'IMPROVED', comparable: true, handoffReference: 'flag:' + original.id } })
    expect(await loadSiteFlags(site())).toMatchObject([{ sourceFlagId: later.id, verificationState: 'still_open' }])
    expect(await loadSiteResolvedFlags(site())).toMatchObject([{ sourceFlagId: original.id, status: 'VERIFIED' }])
  })

  it('continues past a full page of dated but unproven recovery references', async () => {
    const empty = await prisma.audit.create({ data: { userId: owner, projectId, url, status: 'COMPLETED', completedAt: at(300), executionSpec: spec } })
    for (let index = 0; index < 130; index++) await flag(undefined, 1, empty.id)
    const original = await flag()
    expect(await loadSiteResolvedFlags(site())).toMatchObject([{ sourceFlagId: original.id, status: 'FIXED' }])
  })

  it('refuses changed source conditions between proof selection and presentation', async () => {
    const original = await flag()
    const targets = JSON.parse(JSON.stringify(original.evidenceTargets)) as Array<{ context: string }>
    targets[0].context = targets[0].context.replace(/:[a-f0-9]{64}:/, ':' + '0'.repeat(64) + ':')
    const read = prisma.flag.findMany.bind(prisma.flag)
    let changed = false
    vi.spyOn(prisma.flag, 'findMany').mockImplementation(async args => {
      if (!changed && args?.select?.evidence) {
        await prisma.flag.update({ where: { id: original.id }, data: { evidenceTargets: targets } })
        changed = true
      }
      return read(args)
    })
    await expect(loadSiteResolvedFlags(site())).rejects.toMatchObject({ status: 409 })
    expect(changed).toBe(true)
  })

  it('selects legacy repair scope without transferring unrelated historical diagnoses and proposals', async () => {
    const improvement = await incident('VERIFIED')
    const original = await flag(improvement.id, 1, null)
    const retained = 'Retained original editor guidance. '.repeat(1000)
    await prisma.improvement.update({ where: { id: improvement.id }, data: { recommendedChange: retained.repeat(30) } })
    const ids = Array.from({ length: 170 }, (_, index) => randomUUID() + '-ignored-' + index)
    await prisma.flag.createMany({ data: ids.map((id, index) => ({ ...detected, id, whyItMatters: 'Retained historical observation',
      auditId: sourceId, source: 'DETERMINISTIC', status: 'IGNORED', position: index + 2, agentPrompt: retained })) })
    await prisma.improvementOccurrence.createMany({ data: ids.map(flagId => ({ improvementId: improvement.id, auditId: sourceId, flagId, kind: 'OBSERVED' })) })
    await prisma.improvementAttempt.create({ data: { improvementId: improvement.id, sourceAuditId: sourceId, verificationAuditId: proofId,
      builder: 'legacy-owner', createdAt: at(10), outcome: 'IMPROVED', comparable: true, handoffReference: 'flag:' + original.id } })
    const transfers: Array<{ rows: number; bytes: number }> = []
    for (const model of [prisma.improvement, prisma.flag]) {
      const read = model.findMany.bind(model) as (...args: unknown[]) => Promise<unknown[]>
      vi.spyOn(model, 'findMany').mockImplementation((async (...args: unknown[]) => {
        const result = await read(...args)
        transfers.push({ rows: result.length, bytes: Buffer.byteLength(JSON.stringify(result)) })
        return result
      }) as never)
    }
    expect(await loadSiteResolvedFlags(site())).toMatchObject([{ id: improvement.id, sourceFlagId: original.id, status: 'VERIFIED' }])
    const actualFindingReadBytes = transfers.reduce((sum, read) => sum + read.bytes, 0)
    expect(actualFindingReadBytes).toBeLessThan(100_000)
    expect(Math.max(...transfers.map(read => read.rows))).toBeLessThanOrEqual(128)
    expect((await prisma.improvement.findUniqueOrThrow({ where: { id: improvement.id } })).recommendedChange).toBe(retained.repeat(30))
    expect((await prisma.flag.findUniqueOrThrow({ where: { id: ids[0] } })).agentPrompt).toBe(retained)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)
    console.info(JSON.stringify({ retainedCharacters: retained.length * 200, actualFindingReadBytes }))
  })

  it('shares a compatible native proof without letting one changed source block its peers', async () => {
    const sources = []
    for (let index = 0; index < 8; index++) sources.push(await flag((await incident()).id))
    const changed = sources.at(-1)!
    const targets = JSON.parse(JSON.stringify(changed.evidenceTargets)) as Array<{ context: string }>
    targets[0].context = targets[0].context.replace(/:[a-f0-9]{64}:/, ':' + '0'.repeat(64) + ':')
    await prisma.flag.update({ where: { id: changed.id }, data: { evidenceTargets: targets } })
    const read = vi.spyOn(prisma.audit, 'findMany')
    const recoveries = await loadSiteResolvedFlags(site())
    expect(recoveries.map(item => item.sourceFlagId).toSorted()).toEqual(sources.slice(0, -1).map(item => item.id).toSorted())
    expect(read).toHaveBeenCalledTimes(1)
    expect(await loadSiteFlags(site())).toMatchObject([{ sourceFlagId: changed.id, status: 'UNVERIFIED' }])
  })

  it('orders an older proven recovery correctly after a newer reference cannot establish recovery', async () => {
    const first = await incident(), second = await incident()
    const empty = await prisma.audit.create({ data: { userId: owner, projectId, url, status: 'COMPLETED', completedAt: at(300), executionSpec: spec } })
    await flag(first.id, 3, empty.id)
    const earlier = await flag(first.id, 1, await proof(200))
    const later = await flag(second.id, 2, await proof(250))
    const recoveries = await loadSiteResolvedFlags(site())
    expect(recoveries.map(item => item.sourceFlagId)).toEqual([later.id, earlier.id])
    expect(recoveries.map(item => item.latestOccurrenceAt)).toEqual([at(250).toISOString(), at(200).toISOString()])
  })
})
