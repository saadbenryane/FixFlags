import { describe, it, vi, expect, beforeEach } from 'vitest'
import assert from 'node:assert/strict'
import type { User } from '@prisma/client'

const { createAndEnqueueAudit, prismaMock } = vi.hoisted(() => ({
  createAndEnqueueAudit: vi.fn(),
  prismaMock: {
    audit: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/audit/create-audit', () => ({
  createAndEnqueueAudit,
}))
vi.mock('@/lib/leads/attribution', () => ({
  buildAttribution: () => ({ source: 'DASHBOARD' }),
}))

import { validateMonitoringParent, startMonitoringAudit } from '@/lib/audit/monitoring'

describe('validateMonitoringParent', () => {
  it('rejects missing parent', () => {
    const result = validateMonitoringParent(null, 'u1')
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 404)
  })

  it('rejects wrong owner', () => {
    const result = validateMonitoringParent(
      { userId: 'other', status: 'COMPLETED' },
      'u1'
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, 403)
      assert.equal(result.error, 'You can only re-check your own reports')
    }
  })

  it('rejects incomplete parent', () => {
    const result = validateMonitoringParent(
      { userId: 'u1', status: 'QUEUED' },
      'u1'
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, 400)
      assert.equal(result.error, 'You can only re-check completed reports')
    }
  })

  it('accepts completed owned parent', () => {
    const result = validateMonitoringParent(
      { userId: 'u1', status: 'COMPLETED' },
      'u1'
    )
    assert.equal(result.ok, true)
  })
})

describe('startMonitoringAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.audit.findUnique.mockResolvedValue({
      userId: 'u1',
      status: 'COMPLETED',
      url: 'https://example.com',
    })
    createAndEnqueueAudit.mockResolvedValue({
      auditId: 'child-1',
      status: 'QUEUED',
      reused: false,
      parentId: 'parent-1',
    })
  })

  it('enqueues a FULL fresh capture re-check (not SUMMARY_ONLY)', async () => {
    const user = { id: 'u1' } as User
    const outcome = await startMonitoringAudit('parent-1', user)
    assert.equal(outcome.ok, true)
    if (outcome.ok) {
      expect(outcome.result).toEqual({
        auditId: 'child-1',
        status: 'QUEUED',
        reused: false,
        parentAuditId: 'parent-1',
      })
    }
    expect(createAndEnqueueAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com',
        userId: 'u1',
        parentId: 'parent-1',
        skipUsageCount: false,
        monitoringMode: 'FULL',
      })
    )
  })
})
