import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(),
  bindingFindMany: vi.fn(), bindingUpdateMany: vi.fn(), transaction: vi.fn(), execute: vi.fn(), encrypt: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    outcomeFixture: {
      findFirst: mocks.findFirst, findMany: mocks.findMany, create: mocks.create,
      update: mocks.update, updateMany: mocks.updateMany, delete: mocks.delete,
    },
    outcomeExecutionBinding: { findMany: mocks.bindingFindMany, updateMany: mocks.bindingUpdateMany },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/security/crypto', () => ({ encryptSecret: mocks.encrypt }))
vi.mock('@/lib/sites/application/safe-form-executor', async (original) => {
  const actual = await original<typeof import('@/lib/sites/application/safe-form-executor')>()
  return { ...actual, executeSafeFormFixture: mocks.execute }
})

import {
  authorizeOutcomeFixture,
  createOutcomeFixture,
  deleteOutcomeFixture,
  dryRunOutcomeFixture,
  OutcomeFixtureError,
  updateOutcomeFixture,
} from '@/lib/sites/application/outcome-fixtures'

const stored = {
  id: 'fixture-1', name: 'Signup', targetUrl: 'https://example.com/signup',
  fieldMapping: { fields: { email: { by: 'label', value: 'Email' } }, submit: { by: 'role', role: 'button', value: 'Create account' } },
  encryptedValues: 'encrypted-values', successCriterion: { type: 'text', value: 'Welcome' },
  resetUrl: 'https://example.com/test/reset', cleanupUrl: 'https://example.com/test/cleanup',
  encryptedHookSecret: 'encrypted-hook', version: 1, lastDryRunVersion: null,
  lastDryRunAt: null, lastDryRunResult: null, authorizedAt: null, enabled: true,
}

const input = {
  name: 'Signup', targetUrl: stored.targetUrl,
  fieldMapping: stored.fieldMapping,
  values: { email: 'synthetic@example.test' },
  successCriterion: stored.successCriterion,
  resetUrl: stored.resetUrl, cleanupUrl: stored.cleanupUrl, hookSecret: 'hook',
} as const

describe('Outcome fixture lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.encrypt.mockImplementation((value: string) => `encrypted:${value}`)
    mocks.create.mockResolvedValue(stored)
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.bindingUpdateMany.mockResolvedValue({ count: 1 })
    mocks.delete.mockResolvedValue(stored)
    mocks.transaction.mockImplementation(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
  })

  it('creates an unauthorized, encrypted fixture on the exact Site origin', async () => {
    const fixture = await createOutcomeFixture({ projectId: 'project-1', siteUrl: 'https://example.com', fixture: input })
    expect(fixture.authorizedAt).toBeNull()
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      projectId: 'project-1', encryptedValues: expect.stringContaining('synthetic@example.test'),
      encryptedHookSecret: 'encrypted:hook', authorizedAt: null,
    }) }))
  })

  it('rejects target and hook URLs outside the exact Site origin', async () => {
    await expect(createOutcomeFixture({
      projectId: 'project-1', siteUrl: 'https://example.com',
      fixture: { ...input, cleanupUrl: 'https://other.example/cleanup' },
    })).rejects.toMatchObject({ code: 'FIXTURE_ORIGIN_MISMATCH' })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('records the dry run against the exact version and keeps authorization revoked', async () => {
    mocks.findFirst.mockResolvedValueOnce(stored).mockResolvedValueOnce({
      ...stored, lastDryRunVersion: 1, lastDryRunAt: new Date(), lastDryRunResult: { disposition: 'SUCCEEDED' },
    })
    mocks.execute.mockResolvedValue({ disposition: 'SUCCEEDED', reason: 'success_criterion_observed', detail: { fieldCount: 1, cleanupStatus: 'succeeded' } })
    const fixture = await dryRunOutcomeFixture({ projectId: 'project-1', fixtureId: stored.id })
    expect(fixture.lastDryRunVersion).toBe(1)
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ requireAuthorization: false }))
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ version: 1 }), data: expect.objectContaining({ authorizedAt: null }),
    }))
  })

  it('authorizes only a successful dry run of the current version', async () => {
    mocks.findFirst.mockResolvedValue({ ...stored, lastDryRunVersion: 1, lastDryRunResult: { disposition: 'FAILED' } })
    await expect(authorizeOutcomeFixture('project-1', stored.id)).rejects.toBeInstanceOf(OutcomeFixtureError)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('authorizes with a version-scoped write so a concurrent edit cannot inherit approval', async () => {
    const exercised = { ...stored, lastDryRunVersion: 1, lastDryRunResult: { disposition: 'SUCCEEDED' } }
    mocks.findFirst.mockResolvedValueOnce(exercised).mockResolvedValueOnce({
      ...exercised, authorizedAt: new Date('2026-10-04T12:00:00Z'),
    })
    mocks.updateMany.mockResolvedValueOnce({ count: 1 })
    const fixture = await authorizeOutcomeFixture('project-1', stored.id)
    expect(fixture.authorizedAt).not.toBeNull()
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ projectId: 'project-1', version: 1, lastDryRunVersion: 1 }),
    }))

    mocks.findFirst.mockResolvedValueOnce(exercised)
    mocks.updateMany.mockResolvedValueOnce({ count: 0 })
    await expect(authorizeOutcomeFixture('project-1', stored.id)).rejects.toMatchObject({ code: 'FIXTURE_CHANGED' })
  })

  it('increments the fixture version and revokes proof when executable configuration changes', async () => {
    mocks.findFirst.mockResolvedValueOnce({ ...stored, authorizedAt: new Date() })
    mocks.update.mockResolvedValueOnce({
      ...stored,
      version: 2,
      lastDryRunVersion: null,
      lastDryRunAt: null,
      lastDryRunResult: null,
      authorizedAt: null,
    })
    const fixture = await updateOutcomeFixture({
      projectId: 'project-1', fixtureId: stored.id, siteUrl: 'https://example.com', fixture: input,
    })
    expect(fixture.version).toBe(2)
    expect(fixture.authorizedAt).toBeNull()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        version: { increment: 1 }, lastDryRunVersion: null, authorizedAt: null,
      }),
    }))
  })

  it('disables every binding that names a deleted fixture', async () => {
    mocks.findFirst.mockResolvedValue(stored)
    mocks.bindingFindMany.mockResolvedValue([
      { id: 'binding-1', config: { fixtureId: stored.id } },
      { id: 'binding-2', config: { fixtureId: 'other' } },
    ])
    await deleteOutcomeFixture('project-1', stored.id)
    expect(mocks.bindingUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ['binding-1'] } }, data: { enabled: false } })
  })
})
