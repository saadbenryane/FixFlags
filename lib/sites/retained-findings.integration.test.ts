import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteFlags } from './flags'
import type { SiteRecord } from './types'
import { loadSiteCheckResultPage } from './application/check-results'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('unresolved claimed findings with migrated PostgreSQL', () => {
  const users: string[] = []
  let site: SiteRecord, sourceFlagId: string, laterAuditId: string, foreignAuditId: string
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    async function owner() {
      const userId = 'retained-' + randomUUID(); users.push(userId)
      await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
      return prisma.project.create({ data: { userId, name: 'Retention fixture', url: 'https://example.com/', canonicalHost: 'example.com' } })
    }
    const owned = await owner(), foreign = await owner()
    const source = await prisma.audit.create({ data: { userId: owned.userId, projectId: owned.id, url: owned.url,
      status: 'COMPLETED', completedAt: new Date('2026-10-01T12:00:00Z'), createdAt: new Date('2026-10-01T12:00:00Z') } })
    const later = await prisma.audit.create({ data: { userId: owned.userId, projectId: owned.id, url: owned.url,
      status: 'COMPLETED', reportCompleteness: 'PARTIAL', completedAt: new Date(), executionSpec: {
        engine: 'progressive-v1', version: 1, targetUrl: owned.url, scope: 'SITE', environment: 'production',
        checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null,
      } } })
    const other = await prisma.audit.create({ data: { userId: foreign.userId, projectId: foreign.id, url: foreign.url,
      status: 'COMPLETED', completedAt: new Date() } })
    const flagData = { source: 'DETERMINISTIC' as const, rubric: 'PERFORMANCE', severity: 'IMPORTANT' as const,
      checkId: 'lcp-poor', problem: 'Main content took 4 seconds to appear', evidence: 'Measured LCP of 4000ms',
      whyItMatters: 'Visitors wait for the main content', fix: 'Improve the resources delaying main content', confidence: 1,
      pageUrl: owned.url, position: 0, fingerprint: 'retained-loading' }
    const flag = await prisma.flag.create({ data: { ...flagData, auditId: source.id } })
    await prisma.flag.create({ data: { ...flagData, auditId: other.id, fingerprint: 'foreign-loading' } })
    site = { kind: 'project', projectId: owned.id, primaryAuditId: later.id } as SiteRecord
    sourceFlagId = flag.id; laterAuditId = later.id; foreignAuditId = other.id
  })
  afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: users } } }) })
  afterAll(() => prisma.$disconnect())

  it('retains the original unresolved Flag across later partial execution and excludes another tenant', async () => {
    expect((await loadSiteFlags(site)).map(flag => flag.sourceFlagId)).toEqual([sourceFlagId])
  })
  it.each(['partial', 'foreign'] as const)('keeps a %s completion reference unverified without passing evidence', async kind => {
    await prisma.flag.update({ where: { id: sourceFlagId }, data: { status: 'FIXED', resolvedInId: kind === 'partial' ? laterAuditId : foreignAuditId } })
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId, status: 'UNVERIFIED', verificationState: 'could_not_verify' }])
  })
  it('counts and paginates the authorized mixed result scope and invalidates a changed receipt', async () => {
    const pageUrl = 'https://example.com/'
    const detail = { assertions: Array.from({ length: 240 }, (_, index) => ({ key: index % 2 ? 'title-presence' : 'viewport-presence',
      name: 'Assertion ' + index, passed: true, expected: 'Present', observed: 'Recorded', context: String(index) })) }
    const data = { targetKey: 'module:metadata', scopeKey: 'product', source: 'DETERMINISTIC' as const,
      status: 'COMPLETED' as const, pageUrl, detail }
    const row = await prisma.auditVerificationReceipt.create({ data: { ...data, auditId: laterAuditId } })
    await prisma.auditVerificationReceipt.create({ data: { ...data, auditId: foreignAuditId } })
    const filter = { area: 'search' as const, pageUrl }
    const first = await loadSiteCheckResultPage(site, laterAuditId, undefined, new Map(), filter, true)
    expect(first.results).toHaveLength(100)
    expect(first.total).toBe(121)
    const second = await loadSiteCheckResultPage(site, laterAuditId, first.nextCursor!, new Map(), filter, true)
    expect(second.results).toHaveLength(21)
    expect(second.total).toBe(121)
    expect(second.nextCursor).toBeNull()
    detail.assertions[1].observed = 'Updated recorded fact'
    await prisma.auditVerificationReceipt.update({ where: { id: row.id }, data: { detail } })
    await expect(loadSiteCheckResultPage(site, laterAuditId, first.nextCursor!, new Map(), filter, true))
      .rejects.toThrow('Check evidence selection changed')
  })
})
