import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, expect } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    audit: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { parsePipelineLog, logPipelineEvent, initPipelineLog } from '../pipeline-log'

describe('parsePipelineLog', () => {
  it('returns an empty array for non-array input', () => {
    assert.deepEqual(parsePipelineLog(null), [])
    assert.deepEqual(parsePipelineLog('nope'), [])
    assert.deepEqual(parsePipelineLog({ ts: 'x', stage: 'y', event: 'z' }), [])
  })

  it('filters out malformed entries', () => {
    const parsed = parsePipelineLog([
      { ts: '2026-01-01', stage: 'queued', event: 'started', durationMs: 5 },
      { ts: '2026-01-01', stage: 'capturing' }, // missing event
      { ts: '2026-01-01', event: 'started' }, // missing stage
      'not-an-object',
      null,
    ])
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].event, 'started')
  })

  it('keeps optional fields', () => {
    const parsed = parsePipelineLog([
      { ts: '2026-01-01', stage: 'judging', event: 'ai_review', durationMs: 42, error: 'boom', detail: 'extra' },
    ])
    assert.equal(parsed[0].durationMs, 42)
    assert.equal(parsed[0].error, 'boom')
    assert.equal(parsed[0].detail, 'extra')
  })
})

describe('logPipelineEvent', () => {
  beforeEach(() => {
    prismaMock.audit.findUnique.mockReset()
    prismaMock.audit.update.mockReset()
  })

  it('appends the event to the existing pipeline log', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      pipelineLog: [{ ts: '2026-01-01', stage: 'queued', event: 'pipeline_started' }],
    })
    prismaMock.audit.update.mockResolvedValue({ id: 'audit-1' })

    await logPipelineEvent('audit-1', {
      stage: 'checking',
      event: 'checks_completed',
      durationMs: 12,
    })

    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: expect.objectContaining({
        pipelineVersion: expect.any(String),
      }),
    })
    const data = prismaMock.audit.update.mock.calls[0][0].data as {
      pipelineLog: Array<{ stage: string; event: string }>
    }
    assert.equal(data.pipelineLog.length, 2)
    assert.equal(data.pipelineLog[1].stage, 'checking')
    assert.equal(data.pipelineLog[1].event, 'checks_completed')
  })

  it('starts from an empty log when the audit has none', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(null)
    prismaMock.audit.update.mockResolvedValue({ id: 'audit-1' })

    await logPipelineEvent('audit-1', { stage: 'queued', event: 'pipeline_started' })
    const data = prismaMock.audit.update.mock.calls[0][0].data as {
      pipelineLog: unknown[]
    }
    assert.equal(data.pipelineLog.length, 1)
  })
})

describe('initPipelineLog', () => {
  beforeEach(() => {
    prismaMock.audit.findUnique.mockReset()
    prismaMock.audit.update.mockReset()
  })

  it('resets the log then writes the pipeline_started event', async () => {
    prismaMock.audit.update.mockResolvedValue({ id: 'audit-1' })
    prismaMock.audit.findUnique.mockResolvedValue(null)

    await initPipelineLog('audit-1')

    expect(prismaMock.audit.update).toHaveBeenCalledTimes(2)
    const firstData = prismaMock.audit.update.mock.calls[0][0].data as {
      pipelineLog: unknown[]
    }
    assert.deepEqual(firstData.pipelineLog, [])
    const secondData = prismaMock.audit.update.mock.calls[1][0].data as {
      pipelineLog: Array<{ stage: string; event: string }>
    }
    assert.equal(secondData.pipelineLog[0].stage, 'queued')
    assert.equal(secondData.pipelineLog[0].event, 'pipeline_started')
  })
})
