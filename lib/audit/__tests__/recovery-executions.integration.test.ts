import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadIncidentRecoveryProofs } from '@/lib/sites/application/incident-proofs'
import { loadRecoveryExecutions } from '../recovery-executions'
import { createRecordedRecoveryReader } from '../recovery-evidence'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from './check-fixtures'
import { runPerformanceChecks } from '../checks/performance'
import { scopePerformanceAssertions } from '../performance-measurement'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
const pageUrl = 'https://example.com/'
const measurement = healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture(pageUrl) } })
const original = { ...runPerformanceChecks(measurement, null, pageUrl)[0], pageUrl }
const spec = { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
  checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null }
function receipt(auditId: string, passed = true) {
  return { kind: 'site-module-check', version: 1, module: 'performance', pageUrl, applicable: true, passed, complete: true,
    assertions: scopePerformanceAssertions(measurement, pageUrl, [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms',
      observed: passed ? '1000ms' : '3000ms', passed, complete: true }]),
    execution: { auditId, taskId: 'measured-speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: new Date().toISOString() } }
}
run('shared recorded recovery selection', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterAll(() => prisma.$disconnect())
  it('batches an owner’s recovery sources without transferring unrelated observation payloads', async () => {
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@example.test' } })
    const project = await prisma.project.create({ data: { userId: owner.id, name: 'Recovery selection', url: pageUrl, canonicalHost: 'example.com' } })
    const audits = Array.from({ length: 65 }, () => ({ id: randomUUID(), userId: owner.id, projectId: project.id, url: pageUrl,
      status: 'COMPLETED' as const, completedAt: new Date(), executionSpec: spec }))
    await prisma.audit.createMany({ data: audits })
    await prisma.auditVerificationReceipt.createMany({ data: audits.flatMap(audit => [
      { auditId: audit.id, targetKey: 'module:performance', scopeKey: 'relevant', pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED' as const, detail: receipt(audit.id) },
      { auditId: audit.id, targetKey: 'module:measurement', scopeKey: 'unrelated', pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED' as const,
        detail: { unrelated: 'Recorded unrelated observation. '.repeat(1000) } },
    ]) })
    const flags = audits.map((audit, index) => ({ ...original, id: 'source-' + index, status: 'FIXED', resolvedInId: audit.id }))
    const auditRead = vi.spyOn(prisma.audit, 'findMany')
    const receiptRead = vi.spyOn(prisma.auditVerificationReceipt, 'findMany')
    try {
      const proofs = (await loadIncidentRecoveryProofs([{ projectId: project.id, flags }])).get(project.id)!
      expect(flags.every(flag => proofs.hasFlag(flag))).toBe(true)
      const auditPayload = (await Promise.all(auditRead.mock.results.map(result => result.value))).flat()
      expect(auditPayload.every(audit => !Object.hasOwn(audit, 'verifierExecutions'))).toBe(true)
      expect(receiptRead).toHaveBeenCalledTimes(2)
      const rows = (await Promise.all(receiptRead.mock.results.map(result => result.value))).flat()
      expect(rows).toHaveLength(65)
      expect(rows.every(row => row.targetKey === 'module:performance')).toBe(true)
      expect(Buffer.byteLength(JSON.stringify([auditPayload, rows]))).toBeLessThan(150_000)
    } finally {
      auditRead.mockRestore(); receiptRead.mockRestore()
      await prisma.user.delete({ where: { id: owner.id } })
    }
  })
  it('retains a matching failure beyond the first receipt batch and refuses another Site’s recovery', async () => {
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@example.test' } })
    const project = await prisma.project.create({ data: { userId: owner.id, name: 'Complete recovery evidence', url: pageUrl, canonicalHost: 'example.com' } })
    const audit = await prisma.audit.create({ data: { userId: owner.id, projectId: project.id, url: pageUrl, status: 'COMPLETED', completedAt: new Date(), executionSpec: spec } })
    try {
      await prisma.auditVerificationReceipt.createMany({ data: Array.from({ length: 601 }, (_, index) => ({
        id: audit.id + '-' + String(index).padStart(4, '0'), auditId: audit.id, targetKey: 'module:performance', scopeKey: 'scope-' + index,
        source: 'DETERMINISTIC', status: 'COMPLETED' as const, pageUrl, detail: receipt(audit.id, index !== 600),
      })) })
      const flags = [{ ...original, id: 'original-condition', status: 'FIXED', resolvedInId: audit.id }]
      const evidence = (await loadRecoveryExecutions([{ auditId: audit.id, flags }])).get(audit.id)!
      expect(evidence).toHaveLength(601)
      expect(createRecordedRecoveryReader({ auditId: audit.id, executionSpec: spec, executions: evidence }).hasRecovery(original)).toBe(false)
      expect((await loadIncidentRecoveryProofs([{ projectId: project.id, flags }])).get(project.id)?.hasFlag(flags[0])).not.toBe(true)
      await prisma.auditVerificationReceipt.update({ where: { id: audit.id + '-0600' }, data: { detail: receipt(audit.id) } })
      expect((await loadIncidentRecoveryProofs([{ projectId: project.id, flags }])).get(project.id)?.hasFlag(flags[0])).toBe(true)
      expect((await loadIncidentRecoveryProofs([{ projectId: 'another-site', flags }])).size).toBe(0)
    } finally { await prisma.user.delete({ where: { id: owner.id } }) }
  })
  it('selects every supporting responsibility as well as the representative and historical Search modules', async () => {
    const audit = await prisma.audit.create({ data: { url: pageUrl, status: 'COMPLETED', completedAt: new Date() } })
    try {
      const targets = ['module:performance', 'check:lcp-poor', 'module:metadata', 'check:title-missing',
        'module:search', 'module:search-presentation', 'module:search-google', 'module:search-google-index', 'module:search-google-performance',
        'module:measurement']
      await prisma.auditVerificationReceipt.createMany({ data: targets.map(targetKey => ({ auditId: audit.id,
        targetKey, source: 'DETERMINISTIC', status: 'COMPLETED' as const, detail: { controlled: targetKey } })) })
      const flags = [{ ...original, supportingObservations: { version: 1, items: ['title-missing', 'search-google-index'].map(checkId => ({
        checkId, source: 'DETERMINISTIC', checkVersion: 1, pageUrl, evidence: 'Original recorded condition', verificationRule: null,
        evidenceTargets: [], provenance: { auditId: 'source', taskId: 'source-task', collectedAt: new Date().toISOString() },
      })) } }]
      const rows = (await loadRecoveryExecutions([{ auditId: audit.id, flags }])).get(audit.id)!
      expect(rows.map(row => row.targetKey).sort()).toEqual(targets.filter(target => target !== 'module:measurement').sort())
      // Candidate selection is not a positive recovery conclusion.
      expect(createRecordedRecoveryReader({ auditId: audit.id, executionSpec: spec, executions: rows }).hasRecovery(flags[0])).toBe(false)
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })
})
