import { describe, expect, it } from 'vitest'
import { computeEnqueueDelay, estimateQueueState } from '@/lib/queue/estimate'

describe('queue estimates', () => {
  it('starts immediately when an idle worker has capacity', () => {
    const estimate = estimateQueueState({
      activeJobs: 0,
      waitingJobs: 0,
      delayedJobs: 4,
      workerCapacity: 2,
    })

    expect(estimate).toMatchObject({
      queued: false,
      jobsAhead: 0,
      estimatedWaitSeconds: 0,
      availableCapacity: 2,
    })
  })

  it('starts immediately when live capacity remains', () => {
    expect(
      estimateQueueState({
        activeJobs: 1,
        waitingJobs: 0,
        workerCapacity: 2,
      }).queued
    ).toBe(false)
  })

  it('waits when all live capacity is occupied', () => {
    expect(
      estimateQueueState({
        activeJobs: 2,
        waitingJobs: 0,
        workerCapacity: 2,
      })
    ).toMatchObject({
      queued: true,
      jobsAhead: 2,
      estimatedWaitSeconds: 30,
    })
  })

  it('accounts for waiting work in worker-sized waves', () => {
    expect(
      estimateQueueState({
        activeJobs: 2,
        waitingJobs: 2,
        workerCapacity: 2,
      })
    ).toMatchObject({
      queued: true,
      jobsAhead: 4,
      estimatedWaitSeconds: 60,
    })
  })

  it('does not claim an immediate start without a ready worker', () => {
    expect(
      estimateQueueState({
        activeJobs: 0,
        waitingJobs: 0,
        workerCapacity: 0,
      })
    ).toMatchObject({
      queued: true,
      estimatedWaitSeconds: 0,
    })
  })

  it('makes rate limiting authoritative and exposes the additive queue contract', () => {
    const estimate = estimateQueueState({
      activeJobs: 0,
      waitingJobs: 0,
      workerCapacity: 1,
    })
    const result = computeEnqueueDelay(45, estimate)

    expect(result).toMatchObject({
      delayMs: 45_000,
      queued: true,
      queueReason: 'rate_limit',
      estimatedWaitSeconds: 45,
      queuePosition: 0,
      queue: {
        state: 'rate_limited',
        jobsAhead: 0,
        estimatedStartSeconds: 45,
      },
    })
    expect(result.queue.scheduledStartAt).toBe(result.scheduledStartAt)
  })
})
