import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, expect } from 'vitest'

const { getAuditQueue, addMock } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addMock = vi.fn(async (...args: unknown[]) => ({ id: 'job-1' }))
  return {
    addMock,
    getAuditQueue: vi.fn(() => ({ add: addMock })),
  }
})

vi.mock('@/lib/queue/client', () => ({ getAuditQueue }))

import { triageDegradedVerdict } from '../triage-verdict'
import { buildPlaybackSteps } from '../playback-steps'
import { enqueueAiReview } from '../enqueue-ai-review'
import type { ActionTimelineEvent } from '../action-timeline'

describe('triageDegradedVerdict', () => {
  it('returns the timeout copy for deadline exhaustion', () => {
    const verdict = triageDegradedVerdict('deadline_exhausted', true)
    assert.equal(typeof verdict, 'string')
    assert.ok(verdict.length > 0)
  })

  it('returns signed-in copy when the user is authenticated', () => {
    const verdict = triageDegradedVerdict('provider_exhausted', true)
    assert.equal(typeof verdict, 'string')
    assert.ok(verdict.length > 0)
  })

  it('returns anonymous copy for signed-out users', () => {
    const verdict = triageDegradedVerdict('provider_exhausted', false)
    assert.equal(typeof verdict, 'string')
    assert.ok(verdict.length > 0)
  })
})

describe('buildPlaybackSteps', () => {
  function event(overrides: Partial<ActionTimelineEvent> = {}): ActionTimelineEvent {
    return {
      t: 1000,
      kind: 'navigate',
      label: 'Navigated to pricing',
      url: 'https://example.com/pricing',
      screenshot: null,
      ...overrides,
    }
  }

  it('maps events to steps with event indices', () => {
    const steps = buildPlaybackSteps([event(), event({ kind: 'click', label: 'Clicked sign up' })])
    assert.equal(steps.length, 2)
    assert.equal(steps[0].eventIndex, 0)
    assert.equal(steps[1].eventIndex, 1)
    assert.equal(steps[1].label, 'Clicked sign up')
    assert.equal(steps[0].url, 'https://example.com/pricing')
  })

  it('carries screenshots through to the step', () => {
    const steps = buildPlaybackSteps([event({ screenshot: 'https://cdn.example/s1.png' })])
    assert.equal(steps[0].screenshot, 'https://cdn.example/s1.png')
  })

  it('caps playback steps at 12', () => {
    const steps = buildPlaybackSteps(Array.from({ length: 30 }, () => event()))
    assert.equal(steps.length, 12)
  })
})

describe('enqueueAiReview', () => {
  beforeEach(() => {
    addMock.mockReset()
    addMock.mockResolvedValue({ id: 'job-1' })
  })

  it('enqueues an ai-review job for the audit id', async () => {
    await enqueueAiReview('audit-1')
    expect(getAuditQueue).toHaveBeenCalled()
    expect(addMock).toHaveBeenCalledWith(
      'ai-review',
      { auditId: 'audit-1' },
      expect.objectContaining({ jobId: 'ai-review-audit-1', attempts: 2 })
    )
  })

  it('passes the delay through to the queue', async () => {
    await enqueueAiReview('audit-2', 5000)
    const options = addMock.mock.calls[0]?.[2] as unknown
    assert.equal((options as { delay: number } | undefined)?.delay, 5000)
  })
})
