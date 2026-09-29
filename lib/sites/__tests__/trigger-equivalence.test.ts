import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Every trigger must enter the same tenant-scoped run command. Ownership, Outcome
 * selection, environment, idempotency, and durable evidence cannot depend on who
 * asked: the Site interface, Watch, MCP, a deployment, the public API, an
 * integration, and an internal retry are adapters, not separate monitoring engines.
 */

const mocks = vi.hoisted(() => ({
  outcomeFindMany: vi.fn(),
  projectFindFirst: vi.fn(),
  runFindUnique: vi.fn(),
  runFindFirst: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  runUpdateMany: vi.fn(),
  runFindMany: vi.fn(),
  runCount: vi.fn(),
  auditFindFirst: vi.fn(),
  createAudit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    siteOutcome: { findMany: mocks.outcomeFindMany },
    project: { findFirst: mocks.projectFindFirst },
    runRequest: {
      findUnique: mocks.runFindUnique,
      findFirst: mocks.runFindFirst,
      findMany: mocks.runFindMany,
      create: mocks.runCreate,
      update: mocks.runUpdate,
      updateMany: mocks.runUpdateMany,
      count: mocks.runCount,
    },
    audit: { findFirst: mocks.auditFindFirst },
  },
}))
vi.mock('@/lib/audit/create-audit', () => ({ createAndEnqueueAudit: mocks.createAudit }))
vi.mock('@/lib/analytics/site-events', () => ({
  recordSiteLifecycleEvent: vi.fn().mockResolvedValue({}),
}))

import { requestShopifyOutcomeRun } from '@/lib/sites/application/integration-runs'
import { requestSiteRun } from '@/lib/sites/application/run-requests'

const ownedOutcome = {
  id: 'outcome-1',
  kind: 'CHECKOUT',
  environment: 'production',
  projectId: 'project-1',
  project: { url: 'https://shop.example/' },
  bindings: [{ required: true, config: { startUrl: 'https://shop.example/products/widget' } }],
}

const TRIGGERS = [
  { name: 'Site interface', source: 'WEB' },
  { name: 'Watch', source: 'WATCH' },
  { name: 'MCP', source: 'MCP' },
  { name: 'deployment', source: 'DEPLOYMENT' },
  { name: 'public API', source: 'API' },
  { name: 'internal retry', source: 'INTERNAL' },
] as const

describe('trigger equivalence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.outcomeFindMany.mockResolvedValue([ownedOutcome])
    mocks.projectFindFirst.mockResolvedValue({ url: 'https://shop.example/' })
    mocks.runFindUnique.mockResolvedValue(null)
    mocks.runFindFirst.mockResolvedValue(null)
    mocks.runCreate.mockResolvedValue({ id: 'run-1' })
    mocks.runUpdate.mockResolvedValue({})
    mocks.runCount.mockResolvedValue(0)
    // No abandoned run by default, so these tests stay about trigger equivalence.
    mocks.runFindMany.mockResolvedValue([])
    mocks.auditFindFirst.mockResolvedValue({ id: 'audit-parent' })
    mocks.createAudit.mockResolvedValue({ auditId: 'audit-1', reused: false })
  })

  it.each(TRIGGERS)('$name enters the same tenant-scoped run path', async ({ source }) => {
    const result = await requestSiteRun({
      projectId: 'project-1',
      outcomeIds: ['outcome-1'],
      userId: 'user-1',
      source,
    })

    expect(result.runId).toBe('run-1')
    expect(mocks.runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        projectId: 'project-1',
        environment: 'production',
        requestedByUserId: 'user-1',
        source,
        selections: { create: [{ outcomeId: 'outcome-1' }] },
      }),
    }))
  })

  it('refuses an Outcome the caller does not own, whatever the trigger claims', async () => {
    mocks.outcomeFindMany.mockResolvedValue([])
    await expect(
      requestSiteRun({ projectId: 'project-1', outcomeIds: ['outcome-1'], userId: 'user-1', source: 'MCP' }),
    ).rejects.toThrow('Outcome not found')
    expect(mocks.runCreate).not.toHaveBeenCalled()
  })

  it('reuses the same run when a trigger repeats an idempotency key', async () => {
    mocks.runFindUnique.mockResolvedValue({
      id: 'run-existing',
      projectId: 'project-1',
      environment: 'production',
      auditId: 'audit-existing',
      selections: [{ outcomeId: 'outcome-1' }],
    })
    const result = await requestSiteRun({
      projectId: 'project-1',
      outcomeIds: ['outcome-1'],
      userId: 'user-1',
      source: 'WATCH',
      idempotencyKey: 'watch:project-1:week-3',
    })
    expect(result).toMatchObject({ runId: 'run-existing', reused: true })
    expect(mocks.runCreate).not.toHaveBeenCalled()
  })

  it('rejects an idempotency key reused for a different Outcome selection', async () => {
    mocks.runFindUnique.mockResolvedValue({
      id: 'run-existing',
      projectId: 'project-1',
      environment: 'production',
      selections: [{ outcomeId: 'outcome-2' }],
    })
    await expect(
      requestSiteRun({
        projectId: 'project-1',
        outcomeIds: ['outcome-1'],
        userId: 'user-1',
        source: 'WATCH',
        idempotencyKey: 'watch:project-1:week-3',
      }),
    ).rejects.toThrow('another Outcome selection')
  })

  it('enters the same run command from a Shopify install on a linked Site', async () => {
    mocks.projectFindFirst.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      siteOutcomes: [{ id: 'outcome-1' }],
    })
    const result = await requestShopifyOutcomeRun({
      projectId: 'project-1',
      storefrontUrl: 'https://shop.example/products/widget',
      shopDomain: 'shop.example.myshopify.com',
    })

    expect(result).toMatchObject({ runId: 'run-1' })
    expect(mocks.runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        projectId: 'project-1',
        source: 'INTEGRATION',
        requestedByUserId: 'user-1',
        selections: { create: [{ outcomeId: 'outcome-1' }] },
        context: { action: 'shopify_install', shop: 'shop.example.myshopify.com' },
      }),
    }))
  })

  it('does not invent a run for a shop that is not linked to a claimed Site', async () => {
    await expect(
      requestShopifyOutcomeRun({
        projectId: null,
        storefrontUrl: 'https://shop.example/products/widget',
        shopDomain: 'shop.example.myshopify.com',
      }),
    ).resolves.toBeNull()
    expect(mocks.runCreate).not.toHaveBeenCalled()
  })

  it('does not invent a run for a linked Site with no independently executable Outcome', async () => {
    mocks.projectFindFirst.mockResolvedValue({ id: 'project-1', userId: 'user-1', siteOutcomes: [] })
    await expect(
      requestShopifyOutcomeRun({
        projectId: 'project-1',
        storefrontUrl: 'https://shop.example/products/widget',
        shopDomain: 'shop.example.myshopify.com',
      }),
    ).resolves.toBeNull()
    expect(mocks.runCreate).not.toHaveBeenCalled()
  })
})
