import { describe, expect, it } from 'vitest'
import { evaluateAiVisibility } from '../ai-visibility'
import { AI_VISIBILITY_PROMPTS } from '../ai-visibility-prompts'

const now = new Date('2026-10-20T12:00:00Z')
const observation = { promptId: 'branded-01', platform: 'chatgpt', model: 'recorded-model-v1', observedAt: '2026-10-19T12:00:00Z', answer: 'No matching brand in this public answer.', citationUrls: [] }
const evaluate = (observations: unknown[]) => evaluateAiVisibility({ publicBrandAnswersOnly: true, observations }, now)

describe('recorded public AI visibility evaluation', () => {
  it('fixes 24 unique prompts across four intent categories', () => {
    expect(AI_VISIBILITY_PROMPTS).toHaveLength(24)
    expect(new Set(AI_VISIBILITY_PROMPTS.map(([id]) => id)).size).toBe(24)
    expect(new Set(AI_VISIBILITY_PROMPTS.map(([, category]) => category))).toEqual(new Set(['branded', 'buying', 'comparison', 'negative']))
  })

  it('distinguishes missing observations from an observed absence', () => {
    expect(evaluate([])).toMatchObject({ observationWindow: null, observable: null, coverage: { status: 'unavailable', observations: 0 } })
    const result = evaluate([observation])
    expect(result.observable).toEqual({ brandMentionAnswers: 0, answersWithCitations: 0, answersCitingFixFlags: 0 })
    expect(result.coverage).toMatchObject({ status: 'partial', observedPrompts: 1, observations: 1 })
    expect(result.prompts.find(({ id }) => id === 'branded-02')?.status).toBe('unavailable')
  })

  it('separates observable mentions and citations from manually supplied factual judgments', () => {
    const result = evaluate([{ ...observation, answer: 'FixFlags public answer with withheld unique text.', citationUrls: ['https://fixflags.com/pricing', 'https://example.org/public-article'], review: { offer: 'contradicted' } }])
    expect(result.observable).toEqual({ brandMentionAnswers: 1, answersWithCitations: 1, answersCitingFixFlags: 1 })
    expect(result.factualChecks.status).toBe('manual-review-required')
    expect(result.factualChecks.reviewerJudgment?.offer.contradicted).toBe(1)
    expect(result.factualChecks.reviewerJudgment?.mcp.unreviewed).toBe(1)
    for (const raw of ['unique text', 'https://fixflags.com/pricing', 'recorded-model-v1', 'example.org']) expect(JSON.stringify(result)).not.toContain(raw)
  })

  it('counts repeated observations without inflating prompt coverage and recognizes complete coverage', () => {
    const repeated = evaluate([observation, { ...observation, observedAt: '2026-10-20T11:00:00Z' }])
    expect(repeated.coverage).toMatchObject({ observations: 2, observedPrompts: 1 })
    expect(evaluate(AI_VISIBILITY_PROMPTS.map(([promptId]) => ({ ...observation, promptId }))).coverage.status).toBe('complete')
  })

  it.each([
    { promptId: 'unknown-prompt' }, { model: '' }, { platform: 'unknown-secret-platform' }, { observedAt: '2026-02-30T12:00:00Z' },
    { observedAt: '2027-01-01T12:00:00Z' }, { answer: '' }, { citationUrls: ['https://fixflags.com/share/private-token'] },
    { citationUrls: ['https://fixflags.com/?token=secret'] }, { citationUrls: ['https://127.0.0.1/path'] },
    { citationUrls: ['https://private.internal/path'] }, { citationUrls: ['https://secret:password@fixflags.com/'] },
    { citationUrls: ['not-a-url'] }, { review: { offer: 'invented' } }, { review: { privateCustomer: 'secret' } }, { customerEmail: 'secret@test.test' },
  ])('rejects malformed fields without reflecting their values', (change) => {
    expect(() => evaluate([{ ...observation, ...change }])).toThrow('Invalid public observation dataset')
  })

  it('orders timestamps by time when records mix fractional and whole seconds', () => {
    const result = evaluate([{ ...observation, observedAt: '2026-10-19T12:00:00.900Z' }, observation])
    expect(result.observationWindow).toEqual({ firstObservedAt: observation.observedAt, lastObservedAt: '2026-10-19T12:00:00.900Z' })
  })

  it('rejects duplicates and requires the public-only input declaration', () => {
    expect(() => evaluate([observation, observation])).toThrow()
    expect(() => evaluateAiVisibility({ observations: [] }, now)).toThrow()
    expect(() => evaluateAiVisibility({ publicBrandAnswersOnly: true, observations: [], rawCustomerContent: 'secret' }, now)).toThrow()
  })
})
