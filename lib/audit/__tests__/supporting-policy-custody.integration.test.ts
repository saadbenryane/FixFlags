import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { evaluateSearch, searchFindings } from '../search/registry'
import { searchReceiptSchema } from '../search/contracts'
import { evidence, document, PAGE } from '../search/__tests__/fixtures'
import { readSupportingObservations } from '../flag-observations'
import { persistControlledNativeSource } from '../progressive/__tests__/controlled-native-source'
import { assessVerificationCoverage } from '@/lib/improvements/verification-coverage'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
const absent = '<html><head></head><body>Website</body></html>'
const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: PAGE,
  environment: 'production', checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null }

run('Search policy custody through incremental database publication', () => {
  const audits: string[] = []
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterAll(async () => {
    try { await prisma.audit.deleteMany({ where: { id: { in: audits } } }) }
    finally { await prisma.$disconnect() }
  })

  it('compares every stored source policy after the display representative changes', async () => {
    const parent = await prisma.audit.create({ data: { url: PAGE, executionSpec: spec } })
    audits.push(parent.id)
    for (const input of [evidence(absent), evidence(absent, { rendered: document(null) })]) {
      const flag = searchFindings(await evaluateSearch(input, null, ['presentation'])).find(flag => flag.checkId === 'title-missing')!
      await persistControlledNativeSource(parent.id, [flag], { MESSAGE: null, EXPERIENCE: null, REACH: null })
    }
    const original = await prisma.flag.findFirstOrThrow({ where: { auditId: parent.id, checkId: 'title-missing' } })
    expect(original.attentionPolicy).toMatchObject({ sources: ['original-html'] })
    const observations = readSupportingObservations(original.supportingObservations)!
    expect(observations.items).toHaveLength(2)
    expect(observations.items.map(item => item.attentionPolicy)).toEqual([
      expect.objectContaining({ sources: ['rendered-dom'] }), expect.objectContaining({ sources: ['original-html'] }),
    ])
    const savedSource = JSON.stringify(original.supportingObservations)
    for (const state of ['unavailable', 'missing', 'healthy'] as const) {
      const child = await prisma.audit.create({ data: { url: PAGE, parentId: parent.id, executionSpec: spec,
        status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
      audits.push(child.id)
      const input = evidence(undefined, state === 'unavailable' ? { rendered: document(null) }
        : state === 'missing' ? { rendered: document(absent) } : {})
      const receipt = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: child.id, pageUrl: PAGE,
        collectedAt: input.collectedAt, complete: state !== 'unavailable', observations: await evaluateSearch(input, null, ['presentation']) })
      await prisma.auditVerifierExecution.create({ data: { auditId: child.id, targetKey: 'module:search-presentation',
        scopeKey: 'page:' + PAGE, source: 'SEARCH', status: 'COMPLETED', detail: receipt as Prisma.InputJsonValue } })
      const executions = await prisma.auditVerifierExecution.findMany({ where: { auditId: child.id },
        select: { targetKey: true, scopeKey: true, status: true, evidenceReference: true, detail: true } })
      const decision = assessVerificationCoverage({ auditId: child.id, status: child.status, reportCompleteness: child.reportCompleteness,
        evidenceCoverage: {}, failedModules: [], journeyReviewIncluded: false, journeyReviewAt: null, pages: [],
        source: original.source, checkId: original.checkId, pageUrl: original.pageUrl, originalFlag: original,
        executionSpec: child.executionSpec, verifierExecutions: executions })
      expect(decision.comparable).toBe(state !== 'unavailable')
      if (state !== 'unavailable') expect(decision.verdict).toBe(state === 'healthy' ? 'passed' : 'failed')
    }
    expect(JSON.stringify((await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).supportingObservations)).toBe(savedSource)
  })
})
