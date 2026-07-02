import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach } from 'vitest'

// Controllable prisma + queue doubles. retryAudit only touches audit.findUnique
// / audit.update and the queue, so stub exactly those boundaries.
const auditUpdate = vi.fn().mockResolvedValue({})
const auditFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    audit: {
      findUnique: (...args: unknown[]) => auditFindUnique(...args),
      update: (...args: unknown[]) => auditUpdate(...args),
    },
  },
}))

const queueAdd = vi.fn().mockResolvedValue({})
const queueGetJob = vi.fn()
vi.mock('@/lib/queue/client', () => ({
  getAuditQueue: () => ({
    getJob: (...args: unknown[]) => queueGetJob(...args),
    add: (...args: unknown[]) => queueAdd(...args),
  }),
}))

import { retryAudit } from '@/lib/audit/retry-audit'

beforeEach(() => {
  auditUpdate.mockClear()
  auditFindUnique.mockClear()
  queueAdd.mockClear()
  queueGetJob.mockClear()
})

describe('retryAudit', () => {
  it('clears a lingering active job on a failed audit instead of throwing', async () => {
    auditFindUnique.mockResolvedValue({ id: 'a1', status: 'FAILED', url: 'https://x.com' })
    const moveToFailed = vi.fn().mockResolvedValue(undefined)
    const remove = vi.fn().mockResolvedValue(undefined)
    queueGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('active'),
      moveToFailed,
      remove,
    })

    const result = await retryAudit('a1')

    assert.equal(result.status, 'QUEUED')
    assert.equal(moveToFailed.mock.calls.length, 1) // stale active job killed
    assert.equal(remove.mock.calls.length, 1)
    assert.equal(queueAdd.mock.calls.length, 1) // re-enqueued
    assert.equal(auditUpdate.mock.calls.length, 1)
  })

  it('removes a waiting job without moving it to failed', async () => {
    auditFindUnique.mockResolvedValue({ id: 'a2', status: 'FAILED', url: 'https://x.com' })
    const moveToFailed = vi.fn().mockResolvedValue(undefined)
    const remove = vi.fn().mockResolvedValue(undefined)
    queueGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('waiting'),
      moveToFailed,
      remove,
    })

    await retryAudit('a2')

    assert.equal(moveToFailed.mock.calls.length, 0)
    assert.equal(remove.mock.calls.length, 1)
    assert.equal(queueAdd.mock.calls.length, 1)
  })

  it('rejects retrying an audit that is not terminal', async () => {
    auditFindUnique.mockResolvedValue({ id: 'a3', status: 'CHECKING', url: 'https://x.com' })
    await assert.rejects(retryAudit('a3'), /Can only retry/)
    assert.equal(queueAdd.mock.calls.length, 0)
  })
})
