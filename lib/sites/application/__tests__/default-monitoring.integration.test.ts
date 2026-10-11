import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { productTransaction } from '@/lib/billing/product-transaction'
import { ensureProductProject } from '@/lib/audit/ensure-product-project'
import { ensureDefaultMonitoring, initializeDefaultMonitoring } from '../default-monitoring'

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip

run('automatic monitoring with migrated PostgreSQL', () => {
  const userId = 'monitoring-test-' + randomUUID()
  const now = new Date('2026-10-11T12:00:00Z')

  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !target.pathname.includes('test'))
      throw new Error('This test requires a disposable local test database')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.com', preferredTools: [] } })
  })
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('admits one Site and one executable availability Outcome under concurrent URL admissions', async () => {
    const admissions = await Promise.all([
      ensureProductProject(userId, 'http://example.com:8080/pricing'),
      ensureProductProject(userId, 'http://example.com:8080/contact'),
    ])
    expect(admissions[0].id).toBe(admissions[1].id)
    const site = await prisma.project.findUniqueOrThrow({ where: { id: admissions[0].id }, include: {
      siteOutcomes: { include: { bindings: true } },
    } })
    expect(site.url).toBe('http://example.com:8080')
    expect(site.watchInterval).toBe('WEEKLY')
    expect(site.watchNextRunAt).toBeInstanceOf(Date)
    expect(site.siteOutcomes).toHaveLength(1)
    expect(site.siteOutcomes[0].confirmedAt).toBeInstanceOf(Date)
    expect(site.siteOutcomes[0].bindings).toHaveLength(1)
    expect(site.siteOutcomes[0].bindings[0]).toMatchObject({ mechanism: 'HTTP_AVAILABILITY', required: true, enabled: true,
      config: { startUrl: 'http://example.com:8080', expectedSelector: 'body' } })
  })

  it('preserves existing Outcome identity, custom name, confirmation, binding and schedule on repeated setup', async () => {
    const site = await prisma.project.findFirstOrThrow({ where: { userId } })
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId: site.id } })
    const binding = await prisma.outcomeExecutionBinding.findFirstOrThrow({ where: { outcomeId: outcome.id } })
    await prisma.siteOutcome.update({ where: { id: outcome.id }, data: { name: 'Keep my website reachable', inferenceSource: 'user' } })
    await prisma.outcomeExecutionBinding.update({ where: { id: binding.id }, data: { version: 3 } })
    await productTransaction(tx => ensureDefaultMonitoring(tx, site.id, userId, now))
    const current = await prisma.project.findUniqueOrThrow({ where: { id: site.id } })
    const saved = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id }, include: { bindings: true } })
    expect(current.watchNextRunAt).toEqual(site.watchNextRunAt)
    expect(saved.name).toBe('Keep my website reachable')
    expect(saved.confirmedAt).toEqual(outcome.confirmedAt)
    expect(saved.bindings[0]).toMatchObject({ id: binding.id, version: 3 })
    expect(await productTransaction(tx => ensureDefaultMonitoring(tx, site.id, 'foreign-user', now))).toBe(false)
  })

  it('backfills untouched Sites without reactivating an explicit pause', async () => {
    // The existing Site is explicitly paused; upkeep must leave it alone.
    const existing = await prisma.project.findFirstOrThrow({ where: { userId } })
    await prisma.project.update({ where: { id: existing.id }, data: { watchInterval: null, watchNextRunAt: null, watchLastError: 'Paused.' } })
    const legacy = await prisma.project.create({ data: { userId, name: 'Legacy', url: 'https://legacy.example.com', canonicalHost: 'legacy.example.com' } })
    await initializeDefaultMonitoring(20, now)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: legacy.id } })).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: now })
    expect(await prisma.siteOutcome.count({ where: { projectId: legacy.id, slug: 'page-loads', bindings: { some: { mechanism: 'HTTP_AVAILABILITY' } } } })).toBe(1)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({ watchInterval: null, watchNextRunAt: null, watchLastError: 'Paused.' })
  })
})
