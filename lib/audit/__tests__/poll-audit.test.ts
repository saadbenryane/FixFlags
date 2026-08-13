import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, expect } from 'vitest'

const { prismaMock, recoverAuditJobOnPoll } = vi.hoisted(() => ({
  prismaMock: {
    audit: { findUnique: vi.fn() },
  },
  recoverAuditJobOnPoll: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/audit/recover-audit-job', () => ({ recoverAuditJobOnPoll }))
vi.mock('@/lib/utils/sleep', () => ({ sleep: vi.fn(async () => {}) }))

import { pollAuditUntilDone } from '../poll-audit'

function auditRow(status: string) {
  return { status, updatedAt: new Date(), startedAt: new Date(), createdAt: new Date() }
}

describe('pollAuditUntilDone', () => {
  beforeEach(() => {
    prismaMock.audit.findUnique.mockReset()
    recoverAuditJobOnPoll.mockReset()
  })

  it('returns immediately when the audit is already terminal', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(auditRow('COMPLETED'))
    const result = await pollAuditUntilDone({ auditId: 'audit-1', timeoutMs: 1000, intervalMs: 10 })
    assert.deepEqual(result, { status: 'COMPLETED', timedOut: false })
    expect(recoverAuditJobOnPoll).not.toHaveBeenCalled()
  })

  it('runs recovery for non-terminal audits before re-checking', async () => {
    prismaMock.audit.findUnique
      .mockResolvedValueOnce(auditRow('CHECKING'))
      .mockResolvedValueOnce(auditRow('COMPLETED'))
    const result = await pollAuditUntilDone({ auditId: 'audit-1', timeoutMs: 1000, intervalMs: 10 })
    assert.deepEqual(result, { status: 'COMPLETED', timedOut: false })
    expect(recoverAuditJobOnPoll).toHaveBeenCalledWith('audit-1', expect.objectContaining({ status: 'CHECKING' }))
  })

  it('stops early when a FAILED status arrives', async () => {
    prismaMock.audit.findUnique
      .mockResolvedValueOnce(auditRow('CAPTURING'))
      .mockResolvedValueOnce(auditRow('FAILED'))
    const result = await pollAuditUntilDone({ auditId: 'audit-1', timeoutMs: 1000, intervalMs: 10 })
    assert.deepEqual(result, { status: 'FAILED', timedOut: false })
  })

  it('returns timedOut with the final status when the timeout elapses', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(auditRow('QUEUED'))
    const result = await pollAuditUntilDone({ auditId: 'audit-1', timeoutMs: 5, intervalMs: 1 })
    assert.deepEqual(result, { status: 'QUEUED', timedOut: true })
  })

  it('aborts the loop when the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    prismaMock.audit.findUnique.mockResolvedValue(auditRow('QUEUED'))
    const result = await pollAuditUntilDone({
      auditId: 'audit-1',
      timeoutMs: 1000,
      intervalMs: 10,
      signal: controller.signal,
    })
    assert.deepEqual(result, { status: 'QUEUED', timedOut: true })
  })
})
