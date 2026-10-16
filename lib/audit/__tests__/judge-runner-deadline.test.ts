import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sleep = vi.hoisted(() => vi.fn(async (ms: number) => { await vi.advanceTimersByTimeAsync(ms) }))
vi.mock('@/lib/audit/judge-config', () => ({ getConfiguredJudgeProviderChain: () => ['first', 'fallback'] }))
vi.mock('@/lib/audit/llm-keys', () => ({ hasAnthropicProviderKey: () => false, getOpenAIProviderKey: () => null }))
vi.mock('@/lib/audit/judge', () => ({ isRetryableJudgeError: () => true }))
vi.mock('@/lib/utils/sleep', () => ({ sleep }))
import { runLlmWithRetry } from '../judge-runner'

describe('provider execution time budget', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); sleep.mockClear() })
  afterEach(() => vi.useRealTimers())

  it('bounds backoff and stops further attempts and fallback once the shared budget expires', async () => {
    const attemptFn = vi.fn(async () => { vi.advanceTimersByTime(80); throw new Error('Provider unavailable') })
    await expect(runLlmWithRetry({ label: 'prescription', input: {}, attemptFn, deadline: 100 }))
      .rejects.toMatchObject({ code: 'ETIMEDOUT' })
    expect(attemptFn).toHaveBeenCalledOnce()
    expect(sleep).toHaveBeenCalledExactlyOnceWith(20)
    expect(Date.now()).toBe(100)
  })

  it('never starts an expired operation and returns an observation that completes within budget', async () => {
    const attemptFn = vi.fn(async () => 'observed')
    await expect(runLlmWithRetry({ label: 'prescription', input: {}, attemptFn, deadline: 0 })).rejects.toMatchObject({ code: 'ETIMEDOUT' })
    expect(attemptFn).not.toHaveBeenCalled()
    await expect(runLlmWithRetry({ label: 'prescription', input: {}, attemptFn, deadline: 100 })).resolves.toBe('observed')
  })

  it('retains provider fallback within budget and existing retry behavior when no budget is supplied', async () => {
    const fallback = vi.fn().mockRejectedValueOnce(new Error('Provider refused')).mockResolvedValue('fallback observation')
    await expect(runLlmWithRetry({ label: 'prescription', input: {}, attemptFn: fallback, deadline: 100, isRetryable: () => false }))
      .resolves.toBe('fallback observation')
    expect(fallback.mock.calls.map(call => call[0])).toEqual(['first', 'fallback'])
    const retry = vi.fn().mockRejectedValueOnce(new Error('Provider unavailable')).mockResolvedValue('retry observation')
    await expect(runLlmWithRetry({ label: 'prescription', input: {}, attemptFn: retry })).resolves.toBe('retry observation')
    expect(sleep).toHaveBeenCalledWith(2000)
  })
})
