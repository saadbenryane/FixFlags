import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, expect } from 'vitest'
import { fixedClock } from '@/lib/time/clock'

const { prismaMock, transactionMock } = vi.hoisted(() => {
  const transactionMock = {
    $executeRaw: vi.fn(),
    audit: { update: vi.fn() },
    auditPipelineEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return {
    transactionMock,
    prismaMock: {
      auditPipelineEvent: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(
        async (callback: (tx: typeof transactionMock) => unknown) => callback(transactionMock)
      ),
    },
  }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import {
  parsePipelineLog,
  listPipelineEvents,
  logPipelineEvent,
  initPipelineLog,
} from '../pipeline-log'

describe('parsePipelineLog', () => {
  it('returns an empty array for non-array input', () => {
    assert.deepEqual(parsePipelineLog(null), [])
    assert.deepEqual(parsePipelineLog('nope'), [])
  })

  it('normalizes stored ledger rows and filters malformed entries', () => {
    const parsed = parsePipelineLog([
      {
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        stage: 'judging',
        event: 'judge_failed',
        status: 'failed',
        executionId: 'audit-1:2',
        traceId: 'trace-1',
        attempt: 2,
        durationMs: 42,
        detail: { error: 'boom', detail: 'extra' },
      },
      { occurredAt: new Date(), stage: 'capturing' },
    ])
    assert.equal(parsed.length, 1)
    assert.deepEqual(parsed[0], {
      ts: '2026-01-01T00:00:00.000Z',
      stage: 'judging',
      event: 'judge_failed',
      status: 'failed',
      executionId: 'audit-1:2',
      traceId: 'trace-1',
      attempt: 2,
      durationMs: 42,
      error: 'boom',
      detail: 'extra',
    })
  })
})

describe('pipeline event ledger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditPipelineEvent.findFirst.mockResolvedValue({
      executionId: 'audit-1:1',
      traceId: 'trace-1',
      attempt: 1,
    })
    prismaMock.auditPipelineEvent.create.mockResolvedValue({ id: 'event-1' })
    transactionMock.auditPipelineEvent.findFirst.mockResolvedValue(null)
    transactionMock.auditPipelineEvent.create.mockResolvedValue({ id: 'event-1' })
    transactionMock.audit.update.mockResolvedValue({ id: 'audit-1' })
  })

  it('appends one immutable event without reading or rewriting prior events', async () => {
    await logPipelineEvent(
      'audit-1',
      { stage: 'checking', event: 'checks_completed', durationMs: 12 },
      { clock: fixedClock(new Date('2026-01-01T00:00:00.000Z')) }
    )

    expect(prismaMock.auditPipelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        auditId: 'audit-1',
        executionId: 'audit-1:1',
        traceId: 'trace-1',
        attempt: 1,
        stage: 'checking',
        event: 'checks_completed',
        status: 'completed',
        durationMs: 12,
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    })
  })

  it('returns events in execution order', async () => {
    prismaMock.auditPipelineEvent.findMany.mockResolvedValue([
      {
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        stage: 'queued',
        event: 'pipeline_started',
        status: 'started',
      },
    ])
    const events = await listPipelineEvents('audit-1')
    expect(events).toHaveLength(1)
    expect(prismaMock.auditPipelineEvent.findMany).toHaveBeenCalledWith({
      where: { auditId: 'audit-1' },
      orderBy: [{ attempt: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
    })
  })

  it('starts a new locked execution attempt without deleting history', async () => {
    const trace = await initPipelineLog('audit-1', {
      traceId: 'trace-new',
      clock: fixedClock(new Date('2026-01-02T00:00:00.000Z')),
    })

    expect(trace).toEqual({
      executionId: 'audit-1:1',
      traceId: 'trace-new',
      attempt: 1,
    })
    expect(transactionMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { pipelineVersion: expect.any(String) },
    })
    expect(transactionMock.auditPipelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        auditId: 'audit-1',
        event: 'pipeline_started',
        status: 'started',
      }),
    })
  })
})
