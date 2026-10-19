import { beforeEach, describe, expect, it, vi } from 'vitest'

const provider = vi.hoisted(() => ({ name: 'openai' as 'openai' | 'anthropic', model: 'controlled-model', create: vi.fn() }))
vi.mock('openai', () => ({ default: class { chat = { completions: { create: provider.create } } } }))
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create: provider.create } } }))
vi.mock('../llm-keys', () => ({ hasAnthropicProviderKey: () => true, getOpenAIProviderKey: () => 'controlled-key' }))
vi.mock('../judge-config', () => ({ getConfiguredJudgeProviderChain: () => [provider.name],
  getPrescriptionProviderConfig: () => ({ model: provider.model, timeoutMs: 1000, maxTokens: 1000, reasoningEffort: provider.model === 'gpt-6-luna' ? 'none' : undefined }),
  getProviderConfig: () => ({ model: 'controlled-model', timeoutMs: 1000, maxTokens: 1000 }) }))
vi.mock('@/lib/utils/sleep', () => ({ sleep: vi.fn(async () => undefined) }))
import { PartialPrescriptionError, runPrescriptionWithRetry, type PrescriptionContext } from '../judge-prescription'
import { MAX_RETRIES, type LlmUsage } from '../judge-runner'
import { JudgeContractError } from '../validate-judge-output'

const key = 'search-duplicate-title'
function fixture(onAttempt: PrescriptionContext['onAttempt']): PrescriptionContext {
  return { url: 'https://example.com/', verdict: 'Recorded evidence', score: 70,
    metadata: { pageText: 'Recorded product title', title: 'Product title', description: null, h1s: [], h2s: [], ctaTexts: [] },
    techStack: [], existingFlags: [{ flagKey: key, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'POLISH',
      attention: 'recommendation', fix: '', problem: 'Review the recorded duplicate title',
      evidence: 'The recorded product pages use the same title text.', whyItMatters: 'Distinct destinations may need different search-preview wording.',
      verificationRule: 'Inspect the original pages and compare their recorded title text.', checkId: key }],
    rubrics: ['MESSAGE', 'EXPERIENCE', 'REACH'].map(name => ({ name, grade: null, score: null, summary: 'Recorded scope' })), onAttempt } as unknown as PrescriptionContext
}
function payload(conditional: boolean) {
  return { flagPrescriptions: { [key]: conditional ? {
    inspection: 'the recorded product title across the compared pages',
    changeCondition: 'the product pages serve different purposes and their titles do not identify those purposes',
    changeIfConfirmed: 'give each distinct product page a title grounded in its own verified content',
    preserve: 'titles on intentionally equivalent pages and unrelated metadata',
  } : { fix: 'Change the duplicate product title to different wording.', agentPrompt: null } } }
}
function response(conditional: boolean) {
  return provider.name === 'openai'
    ? { model: provider.model, choices: [{ message: { content: JSON.stringify(payload(conditional)) } }], usage: { prompt_tokens: 20, completion_tokens: 5 } }
    : { model: provider.model, content: [{ type: 'tool_use', input: payload(conditional) }], usage: { input_tokens: 20, output_tokens: 5 } }
}
function userText(request: { messages: Array<{ role: string; content: Array<{ type: string; text?: string }> }> }) {
  return request.messages.find(message => message.role === 'user')!.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
}

describe('bounded prescription correction', () => {
  beforeEach(() => { provider.create.mockReset(); provider.model = 'controlled-model' })

  it('uses the documented completion budget and disables reasoning for the selected Luna contract', async () => {
    provider.name = 'openai'; provider.model = 'gpt-6-luna'
    provider.create.mockResolvedValueOnce(response(true))
    await runPrescriptionWithRetry(fixture(undefined), null, null)
    expect(provider.create.mock.calls[0][0]).toMatchObject({ model: 'gpt-6-luna', max_completion_tokens: 1000, reasoning_effort: 'none' })
    expect(provider.create.mock.calls[0][0].max_tokens).toBeUndefined()
  })

  it.each(['openai', 'anthropic'] as const)('supplies the rejected contract to the next %s attempt without changing source facts', async name => {
    provider.name = name
    provider.create.mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true))
    const record = vi.fn<(usage: LlmUsage | null) => Promise<void>>().mockResolvedValue(undefined)
    const admission = vi.fn(async () => record), context = fixture(admission)
    const original = structuredClone(context.existingFlags)
    const result = await runPrescriptionWithRetry(context, null, null)
    expect(result.output.flagPrescriptions[0].fix).toContain('Review the recorded product title across the compared pages.')
    expect(result.output.flagPrescriptions[0].fix).toContain('Make a change only if')
    expect(provider.create).toHaveBeenCalledTimes(2)
    const first = userText(provider.create.mock.calls[0][0]), second = userText(provider.create.mock.calls[1][0])
    expect(first).not.toContain('PREVIOUS RESPONSE REJECTED')
    expect(second).toContain('PREVIOUS RESPONSE REJECTED')
    const feedback = second.split('PREVIOUS RESPONSE REJECTED')[1]
    expect(feedback).toContain('inspection')
    expect(feedback).toContain(key)
    expect(feedback).toContain('.inspection:')
    expect(second).toContain(original[0].evidence)
    expect(context.existingFlags).toEqual(original)
    expect(admission).toHaveBeenCalledTimes(2)
    expect(record).toHaveBeenCalledTimes(2)
    expect(record.mock.calls.every(([usage]) => usage?.inputTokens === 20 && usage.outputTokens === 5)).toBe(true)
  })

  it('keeps the original attempt limit and refuses persistent invalid guidance', async () => {
    provider.name = 'openai'
    provider.create.mockResolvedValue(response(false))
    const record = vi.fn<(usage: LlmUsage | null) => Promise<void>>().mockResolvedValue(undefined), context = fixture(async () => record)
    await expect(runPrescriptionWithRetry(context, null, null)).rejects.toThrow(/Invalid prescription output.*inspection/)
    expect(provider.create).toHaveBeenCalledTimes(MAX_RETRIES)
    expect(record).toHaveBeenCalledTimes(MAX_RETRIES)
    expect(context.existingFlags[0].fix).toBe('')
  })

  it('retains a quality-contract failure after the final rejected schema response', async () => {
    provider.name = 'openai'
    provider.create.mockResolvedValue(response(false))
    await expect(runPrescriptionWithRetry(fixture(undefined), null, null)).rejects.toBeInstanceOf(JudgeContractError)
    expect(provider.create).toHaveBeenCalledTimes(MAX_RETRIES)
  })

  it.each([false, true])('keeps validated batch membership and aggregate guidance when the later batch fails: %s', async fails => {
    provider.name = 'openai'
    const record = vi.fn<(usage: LlmUsage | null) => Promise<void>>().mockResolvedValue(undefined)
    const context = fixture(async () => record)
    context.existingFlags = Array.from({ length: 13 }, (_, index) => ({ ...context.existingFlags[0],
      flagKey: `recorded-title-${index}`, problem: `Review the recorded product title ${index}` }))
    const before = structuredClone(context.existingFlags)
    provider.create.mockImplementation(async request => {
      const keys: string[] = request.response_format.json_schema.schema.properties.flagPrescriptions.required
      const task = payload(!(fails && keys.includes('recorded-title-12'))).flagPrescriptions[key]
      return { model: 'controlled-model', usage: { prompt_tokens: 20, completion_tokens: 5 },
        choices: [{ message: { content: JSON.stringify({ flagPrescriptions: Object.fromEntries(keys.map(key => [key, task])) }) } }] }
    })
    let output
    try {
      const result = await runPrescriptionWithRetry(context, null, null)
      expect(fails).toBe(false)
      output = result.output
    } catch (error) {
      expect(fails).toBe(true)
      expect(error).toBeInstanceOf(PartialPrescriptionError)
      output = (error as PartialPrescriptionError).partial.output
    }
    expect(output.flagPrescriptions.map(item => item.flagKey)).toEqual(before.slice(0, fails ? 12 : 13).map(item => item.flagKey))
    const combined = output.rubricPrescriptions.find(item => item.name === 'REACH')!.rubricPrompt
    for (const item of output.flagPrescriptions) {
      expect(combined).toContain(item.fix)
      expect(combined).toContain(before.find(source => source.flagKey === item.flagKey)!.problem)
    }
    expect(record).toHaveBeenCalledTimes(fails ? 1 + MAX_RETRIES : 2)
    expect(context.existingFlags).toEqual(before)
  })
})
