import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const queueAdd = vi.hoisted(() => vi.fn(async () => ({ id: 'queued' })))
const projectState = vi.hoisted(() => ({ id: '' }))

vi.mock('@/lib/queue/client', () => ({
  getAuditQueue: () => ({ add: queueAdd }),
}))
vi.mock('@/lib/audit/ai-report-entitlement', () => ({
  resolveIncludeAiForNewAudit: vi.fn(async () => false),
}))
vi.mock('@/lib/billing/deep-review-limit', () => ({
  wouldBlockDeepReview: vi.fn(() => false),
}))
vi.mock('@/lib/billing/credits', () => ({
  wouldBlockNewCheckWithCredits: vi.fn(async () => ({ allowed: true })),
}))
vi.mock('@/lib/audit/ensure-product-project', () => ({
  ensureProductProject: vi.fn(async () => ({ id: projectState.id })),
}))
const trackAnonymousAuditId = vi.hoisted(() => vi.fn())
vi.mock('@/lib/audit/usage', () => ({
  checkAnonymousAuditAllowed: vi.fn(async () => ({ allowed: true })),
  enforceAnonymousIpSoftCeiling: vi.fn(),
  trackAnonymousAuditId,
}))

import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { prisma } from '@/lib/db'

const runPostgres =
  process.env.REVIEW_CONCURRENCY_DB_REQUIRED === 'true' ? describe : describe.skip

runPostgres('manual Review creation PostgreSQL boundary', () => {
  const suffix = randomUUID()
  const userId = `review-concurrency-user-${suffix}`
  const projectId = `review-concurrency-project-${suffix}`
  const url = 'https://example.com/'

  beforeEach(async () => {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required')
    const hostname = new URL(databaseUrl).hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      throw new Error('Review concurrency integration tests require a local PostgreSQL database')
    }

    queueAdd.mockClear()
    projectState.id = projectId
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        preferredTools: [],
        auditsLimit: 100,
      },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        userId,
        name: 'Concurrency fixture',
        url,
        canonicalHost: new URL(url).hostname,
      },
    })
  })

  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.project.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  async function completedParent(id: string) {
    return prisma.audit.create({
      data: {
        id,
        userId,
        projectId,
        url,
        status: 'COMPLETED',
        completedAt: new Date(),
        includeAi: false,
      },
    })
  }

  it('creates one countable first Review for two concurrent manual starts', async () => {
    const results = await Promise.all([
      createAndEnqueueAudit({ url, userId }),
      createAndEnqueueAudit({ url, userId }),
    ])

    expect(new Set(results.map((result) => result.auditId)).size).toBe(1)
    expect(results.filter((result) => result.reused)).toHaveLength(1)
    expect(results.every((result) => result.parentId === null)).toBe(true)
    expect(await prisma.audit.count({ where: { userId, skipUsageCount: false } })).toBe(1)
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: results[0]!.auditId } })).isPublic).toBe(false)
    expect(queueAdd).toHaveBeenCalledTimes(1)
  })

  it('creates one child for two concurrent update Review starts', async () => {
    const parent = await completedParent(`review-parent-${suffix}`)

    const results = await Promise.all([
      createAndEnqueueAudit({ url, userId, parentId: parent.id }),
      createAndEnqueueAudit({ url, userId, parentId: parent.id }),
    ])

    expect(new Set(results.map((result) => result.auditId)).size).toBe(1)
    expect(results.filter((result) => result.reused)).toHaveLength(1)
    expect(results.every((result) => result.parentId === parent.id)).toBe(true)
    expect(await prisma.audit.count({ where: { parentId: parent.id } })).toBe(1)
    expect(queueAdd).toHaveBeenCalledTimes(1)
  })

  it('returns the active Review and its real parent for a conflicting request', async () => {
    const firstParent = await completedParent(`review-parent-a-${suffix}`)
    const secondParent = await completedParent(`review-parent-b-${suffix}`)
    const active = await createAndEnqueueAudit({
      url,
      userId,
      parentId: firstParent.id,
    })

    const resumed = await createAndEnqueueAudit({
      url,
      userId,
      parentId: secondParent.id,
    })

    expect(resumed).toMatchObject({
      auditId: active.auditId,
      reused: true,
      parentId: firstParent.id,
    })
    expect(await prisma.audit.count({ where: { projectId, status: 'QUEUED' } })).toBe(1)
    expect(queueAdd).toHaveBeenCalledTimes(1)
  })

  it('allows one Watch observation alongside one manual Review', async () => {
    const parent = await completedParent(`review-parent-watch-${suffix}`)

    const [manual, watch] = await Promise.all([
      createAndEnqueueAudit({ url, userId, parentId: parent.id }),
      createAndEnqueueAudit({
        url,
        userId,
        parentId: parent.id,
        recheckTrigger: 'WATCH',
        skipUsageCount: true,
      }),
    ])

    expect(manual.reused).toBe(false)
    expect(watch.reused).toBe(false)
    expect(manual.auditId).not.toBe(watch.auditId)
    await expect(
      prisma.audit.groupBy({
        by: ['recheckTrigger'],
        where: { parentId: parent.id },
        _count: { _all: true },
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recheckTrigger: 'MANUAL', _count: { _all: 1 } }),
        expect.objectContaining({ recheckTrigger: 'WATCH', _count: { _all: 1 } }),
      ])
    )
    expect(queueAdd).toHaveBeenCalledTimes(2)
  })
})

runPostgres('visitor-owned anonymous reuse PostgreSQL boundary', () => {
  const suffix = randomUUID()
  const url = `https://example.com/anon-reuse-${suffix}`
  const visitorKey = `anonymous-reuse-${suffix}`

  beforeEach(() => { queueAdd.mockClear(); trackAnonymousAuditId.mockClear() })
  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { url } })
    await prisma.provisionalSite.deleteMany({ where: { sessionKey: { startsWith: visitorKey } } })
  })

  it.each(['COMPLETED', 'CHECKING'] as const)('reuses the same visitor’s %s scan and refreshes claim access', async status => {
    const admitted = await createAndEnqueueAudit({ url, visitorKey })
    await prisma.audit.update({ where: { id: admitted.auditId }, data: { status, ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}) } })
    queueAdd.mockClear(); trackAnonymousAuditId.mockClear()
    const result = await createAndEnqueueAudit({ url, visitorKey })
    expect(result).toEqual({ auditId: admitted.auditId, status, reused: true, parentId: null, siteId: admitted.siteId })
    expect(queueAdd).not.toHaveBeenCalled()
    expect(trackAnonymousAuditId).toHaveBeenCalledWith(admitted.auditId)
  })

  it('creates an independent board for a different visitor at the exact same URL', async () => {
    const first = await createAndEnqueueAudit({ url, visitorKey })
    const other = await createAndEnqueueAudit({ url, visitorKey: visitorKey + '-other' })
    expect(other.reused).toBe(false)
    expect(other.auditId).not.toBe(first.auditId)
    expect(other.siteId).not.toBe(first.siteId)
    expect(queueAdd).toHaveBeenCalledTimes(2)
  })

  it('creates a new teaser on the same board when its own completed scan is older than one hour', async () => {
    const admitted = await createAndEnqueueAudit({ url, visitorKey })
    await prisma.audit.update({ where: { id: admitted.auditId }, data: { status: 'COMPLETED',
      completedAt: new Date(Date.now() - 61 * 60 * 1000), createdAt: new Date(Date.now() - 62 * 60 * 1000) } })
    queueAdd.mockClear(); trackAnonymousAuditId.mockClear()
    const result = await createAndEnqueueAudit({ url, visitorKey })
    expect(result.reused).toBe(false)
    expect(result.auditId).not.toBe(admitted.auditId)
    expect(result.siteId).toBe(admitted.siteId)
    expect(queueAdd).toHaveBeenCalledOnce()
    expect(trackAnonymousAuditId).toHaveBeenCalledWith(result.auditId)
  })
})
