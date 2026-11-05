import assert from 'node:assert/strict'
import { beforeEach, describe, it, vi } from 'vitest'

const boundary = vi.hoisted(() => ({ source: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findUnique: boundary.source } } }))
const { assertAuditAccess } = await import('@/lib/mcp/tools')
const original = { id: 'audit', userId: 'owner-1', isPublic: false, projectId: null, user: { lifecycleStatus: 'ACTIVE' } }
beforeEach(() => { vi.resetAllMocks(); boundary.source.mockResolvedValue(original) })

describe('assertAuditAccess', () => {
  it('checks current recorded authority before granting owner access', async () => {
    await assertAuditAccess(original, 'owner-1')
    assert.equal(boundary.source.mock.calls.length, 1)
  })
  it('denies private unclaimed reports without signed creator proof', async () => {
    boundary.source.mockResolvedValue({ ...original, userId: null, user: null })
    await assert.rejects(() => assertAuditAccess(original, 'someone-else'), /Unauthorized/)
  })
  it('denies a non-owner on a private report', async () => {
    await assert.rejects(() => assertAuditAccess(original, 'someone-else'), /Unauthorized/)
  })
  it.each(['TEAM', 'PAST_DUE', 'BUILDER'])('retains explicit public sharing independently of the former billing condition %s', async condition => {
    boundary.source.mockResolvedValue({ ...original, isPublic: true, user: { lifecycleStatus: 'ACTIVE', condition } })
    await assertAuditAccess(original, 'someone-else')
  })
  it('refuses a former creator and grants the current Site owner', async () => {
    boundary.source.mockResolvedValue({ ...original, projectId: 'site', project: { userId: 'current-owner', deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } })
    await assert.rejects(() => assertAuditAccess(original, 'owner-1'), /Unauthorized/)
    await assertAuditAccess(original, 'current-owner')
  })
})
