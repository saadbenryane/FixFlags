import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { consoleContext } from '@/lib/audit/console-evidence'
import { buildExecutionSpec } from '../execution-spec'

const local = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
local('console observation obligations at scope admission', () => {
  let userId: string, projectId: string, sourceId: string
  const pageUrl = 'https://example.com/', minimumMs = 12_000
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'console-scope-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    projectId = (await prisma.project.create({ data: { userId, name: 'Console admission', url: pageUrl, canonicalHost: 'example.com' } })).id
    const source = await prisma.audit.create({ data: { userId, projectId, url: pageUrl, status: 'COMPLETED', completedAt: new Date(),
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl,
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      flags: { create: { checkId: 'console-errors-critical', rubric: 'EXPERIENCE', severity: 'IMPORTANT', position: 0,
        source: 'DETERMINISTIC', confidence: 1, problem: 'Saved console fixture', evidence: 'Controlled saved observation window',
        whyItMatters: 'The original error occurs late in page load', fix: 'Resolve the original error', pageUrl,
        evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop',
          context: consoleContext('desktop', pageUrl, pageUrl, 'saved-profile', 'public', minimumMs) }] } } } })
    sourceId = source.id
  })
  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { projectId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it.each(['SITE', 'conversion'] as const)('prepares console windows only when %s admits console execution', async area => {
    const spec = await buildExecutionSpec({ projectId, targetUrl: pageUrl, environment: 'production', outcomes: [],
      ...(area === 'SITE' ? { scope: 'SITE' as const } : { scope: 'CATEGORY' as const, categoryArea: area }) })
    if (area === 'conversion') {
      expect(spec.checks).not.toHaveProperty('console-errors-critical')
      expect(spec.consoleObservationScopes).toBeUndefined()
    } else {
      expect(spec.checks).toHaveProperty('console-errors-critical')
      expect(spec.consoleObservationScopes).toEqual([{ pageUrl, minimumMs }])
    }
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: sourceId } })).toMatchObject({ status: 'COMPLETED' })
  })

  it.each(['scoped', 'global'] as const)('retains an admitted %s Site observation window when newer unrelated console history fills the lookup', async mode => {
    const source = await prisma.audit.findUniqueOrThrow({ where: { id: sourceId } })
    const spec = source.executionSpec as Record<string, import('@prisma/client').Prisma.JsonValue>
    await prisma.audit.update({ where: { id: sourceId }, data: { executionSpec: { ...spec,
      ...(mode === 'scoped' ? { consoleObservationScopes: [{ pageUrl, minimumMs }] } : { consoleObservationMs: minimumMs }) } } })
    await prisma.flag.updateMany({ where: { auditId: sourceId }, data: { createdAt: new Date(0) } })
    const other = pageUrl + 'other'
    const recent = await prisma.audit.create({ data: { userId, projectId, url: other, status: 'COMPLETED',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'OUTCOMES', targetUrl: other,
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    // Saved history exercises admission limits, not 101 actual website visits.
    await prisma.flag.createMany({ data: Array.from({ length: 101 }, (_, position) => ({ auditId: recent.id,
      checkId: 'console-errors-critical', rubric: 'EXPERIENCE', severity: 'IMPORTANT' as const, position,
      source: 'DETERMINISTIC' as const, confidence: 1, problem: 'Unrelated saved console fixture', evidence: 'Controlled recent history',
      whyItMatters: 'An unrelated page was observed', fix: 'Resolve its error', pageUrl: other,
      evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop',
        context: consoleContext('desktop', other, other, 'saved-profile', 'public', 2000) }] })) })
    const admitted = await buildExecutionSpec({ projectId, targetUrl: pageUrl, scope: 'SITE', environment: 'production', outcomes: [] })
    expect(admitted.consoleObservationScopes?.find(scope => scope.pageUrl === pageUrl)?.minimumMs ?? admitted.consoleObservationMs).toBe(minimumMs)
  })
})
