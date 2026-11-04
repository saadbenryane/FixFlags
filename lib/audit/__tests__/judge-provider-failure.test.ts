import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyJudgeProviderFailure, JudgeProviderError } from '../judge'
import { JudgeContractError } from '../validate-judge-output'

const configured = vi.hoisted(() => ({ chain: ['openai'] }))
vi.mock('../judge-config', () => ({ getConfiguredJudgeProviderChain: () => configured.chain }))
vi.mock('../llm-keys', () => ({ hasAnthropicProviderKey: () => false, getOpenAIProviderKey: () => undefined }))
vi.mock('@/lib/utils/sleep', () => ({ sleep: vi.fn(async () => {}) }))

import { runLlmWithRetry } from '../judge-runner'

const quota = () => Object.assign(new Error('429 Credit unavailable'), { status: 429, code: 'credit_balance_exhausted' })
const transient = () => Object.assign(new Error('503 Provider unavailable'), { status: 503 })

afterEach(() => { configured.chain = ['openai'] })

describe('bounded provider failures', () => {
  it('makes one attempt for hard quota and preserves its typed cause for durable recovery', async () => {
    const cause = quota(), attemptFn = vi.fn(async () => { throw cause })
    const error = await runLlmWithRetry({ label: 'Quota fixture', input: {}, attemptFn }).catch(error => error)
    expect(attemptFn).toHaveBeenCalledTimes(1)
    expect(error).toBeInstanceOf(JudgeProviderError)
    expect(error).toMatchObject({ cause, retryable: false })
    expect(classifyJudgeProviderFailure(error)).toBe('quota_exhausted')
  })

  it.each([false, true])('retains recoverable provider availability independently of chain order (quota last: %s)', async quotaLast => {
    configured.chain = quotaLast ? ['recoverable', 'quota'] : ['quota', 'recoverable']
    const attemptFn = vi.fn(async (provider: string) => { throw provider === 'quota' ? quota() : transient() })
    const error = await runLlmWithRetry({ label: 'Mixed provider fixture', input: {}, attemptFn }).catch(error => error)
    expect(attemptFn.mock.calls.filter(([provider]) => provider === 'quota')).toHaveLength(1)
    expect(attemptFn.mock.calls.filter(([provider]) => provider === 'recoverable')).toHaveLength(3)
    expect(error).toBeInstanceOf(JudgeProviderError)
    expect(error.retryable).toBe(true)
  })

  it('settles only after every configured provider is proven unavailable for funding', async () => {
    configured.chain = ['first', 'second']
    const attemptFn = vi.fn(async () => { throw quota() })
    const error = await runLlmWithRetry({ label: 'Funded provider fixture', input: {}, attemptFn }).catch(error => error)
    expect(attemptFn).toHaveBeenCalledTimes(2)
    expect(error).toMatchObject({ retryable: false })
  })

  it('retains established contract-error identity after its bounded retries', async () => {
    const cause = new JudgeContractError('Controlled invalid provider output')
    const attemptFn = vi.fn(async () => { throw cause })
    await expect(runLlmWithRetry({ label: 'Contract fixture', input: {}, attemptFn })).rejects.toBe(cause)
    expect(attemptFn).toHaveBeenCalledTimes(3)
  })
})
