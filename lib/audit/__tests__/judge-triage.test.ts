import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'

const mocks = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  openaiCreate: vi.fn(),
  isProviderConfigured: vi.fn(),
  runLlmWithRetry: vi.fn(),
  isRetryableJudgeError: vi.fn(),
}))

vi.mock('@/lib/audit/judge-runner', () => ({
  anthropic: { messages: { create: mocks.anthropicCreate } },
  openai: { chat: { completions: { create: mocks.openaiCreate } } },
  isProviderConfigured: mocks.isProviderConfigured,
  runLlmWithRetry: mocks.runLlmWithRetry,
}))

vi.mock('@/lib/prompts/system-prompt', () => ({
  buildTriageSystemPrompt: () => 'system prompt',
  buildTriageUserPrompt: () => 'user prompt',
}))

vi.mock('@/lib/audit/judge', () => ({
  isRetryableJudgeError: mocks.isRetryableJudgeError,
}))

import {
  isTriageProviderConfigured,
  normalizeTriageRawOutput,
  runTriageWithRetry,
} from '../judge-triage'
import { triageOutputSchema } from '../judge-triage-schema'

const VALID_OUTPUT = {
  pageJob: 'Sell the product to first-time visitors',
  pageType: 'homepage',
  verdict: 'The page works, but the value proposition is buried below the fold.',
  score: 72,
  launchReadiness: 'fix_first',
  launchChecklist: [
    { id: 'https', label: 'HTTPS', passed: true },
    { id: 'social-preview', label: 'Social preview', passed: true },
    { id: 'mobile-cta', label: 'Mobile CTA', passed: true },
    { id: 'console-errors', label: 'Console errors', passed: true },
    { id: 'privacy-contact', label: 'Privacy and contact', passed: true },
  ],
  rubrics: [
    {
      name: 'MESSAGE',
      score: 70,
      grade: 'C',
      status: 'NEEDS_WORK',
      assessmentState: 'ASSESSED',
      confidence: 0.8,
      summary: 'The headline is clear but the value prop is buried.',
    },
    {
      name: 'EXPERIENCE',
      score: null,
      grade: 'B',
      status: 'GOOD',
      assessmentState: 'PARTIAL',
      confidence: 0.5,
      summary: 'Only partial evidence captured for experience.',
    },
    {
      name: 'REACH',
      score: 55,
      grade: 'D',
      status: 'NEEDS_WORK',
      assessmentState: 'ASSESSED',
      confidence: 0.7,
      summary: 'Social proof is missing below the fold.',
    },
  ],
  newFlags: [
    {
      rubric: 'MESSAGE',
      impactTag: 'CLARITY',
      severity: 'IMPORTANT',
      problem: 'Value proposition buried',
      evidence: 'The first screen shows features before benefits.',
      whyItMatters: 'Users decide in the first seconds whether to stay.',
      confidence: 0.7,
      pageUrl: null,
    },
  ],
}

const FLAGS = [
  {
    checkId: 'no-https',
    problem: 'No HTTPS',
    evidence: 'The site loads over HTTP.',
    rubric: 'REACH' as const,
    severity: 'CRITICAL' as const,
    fix: 'Enable HTTPS',
    fixPrompt: 'Enable HTTPS',
    editorPrompts: [],
    includeInReport: true,
    pageUrl: 'https://example.com',
    confidence: 1,
    source: 'DETERMINISTIC' as const,
  },
]

const METADATA = {
  title: 'Example',
  description: 'Example description',
  ogTitle: null,
  ogDescription: null,
  ogImage: null,
  canonical: null,
  lang: 'en',
  viewport: 'width=device-width',
  robots: null,
  h1s: ['Example'],
  h2s: [],
  images: [],
  imagesWithoutAlt: 0,
  links: [],
  forms: 1,
  inputsWithoutLabel: 0,
  buttonsWithoutText: 0,
  linksWithoutText: 0,
  iframesWithoutTitle: 0,
  positiveTabindex: 0,
  ctaTexts: ['Get started'],
  hasStructuredData: true,
  structuredDataTypes: [],
  hasAnalytics: false,
  hasCookieBasedAnalytics: false,
  hasCookieConsent: false,
  hasPrivacyPolicy: true,
  hasContactInfo: true,
  hasFavicon: true,
  hasSkipLink: false,
  navLandmarkCount: 1,
  pageText: 'Example page text',
  jsonLd: [],
  elementIds: [],
  formInputsMissingValidation: 0,
  totalFormInputs: 1,
  maxConversionFormInputs: 1,
  url: 'https://example.com',
}

/** Mock the retry loop so the triage attemptFn runs against the mocked clients. */
function runAttempt(provider: string, extra: Record<string, unknown> = {}): void {
  mocks.runLlmWithRetry.mockImplementation(
    async ({ attemptFn }: { attemptFn: (p: string, input: Record<string, unknown>) => Promise<unknown> }) =>
      attemptFn(provider, {
        context: { url: 'https://example.com', metadata: METADATA, scores: {}, topOpportunities: [], deterministicFlags: [] },
        flags: FLAGS,
        desktopBase64: null,
        mobileBase64: null,
        ...extra,
      })
  )
}

function resetMocks(): void {
  for (const fn of Object.values(mocks)) {
    fn.mockReset()
  }
  mocks.isProviderConfigured.mockReturnValue(true)
  mocks.isRetryableJudgeError.mockReturnValue(false)
}

describe('isTriageProviderConfigured', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('delegates to the runner configuration check', () => {
    mocks.isProviderConfigured.mockReturnValue(false)
    assert.equal(isTriageProviderConfigured(), false)
    mocks.isProviderConfigured.mockReturnValue(true)
    assert.equal(isTriageProviderConfigured(), true)
  })
})

describe('normalizeTriageRawOutput', () => {
  it('passes through non-objects and arrays', () => {
    assert.equal(normalizeTriageRawOutput(null), null)
    assert.equal(normalizeTriageRawOutput('text'), 'text')
    assert.deepEqual(normalizeTriageRawOutput([1, 2]), [1, 2])
  })

  it('nulls scores for rubrics that were not assessed', () => {
    const raw = {
      rubrics: [
        { name: 'MESSAGE', score: 80, assessmentState: 'ASSESSED' },
        { name: 'EXPERIENCE', score: 60, assessmentState: 'UNKNOWN' },
      ],
    }
    const out = normalizeTriageRawOutput(raw) as { rubrics: Array<Record<string, unknown>> }
    assert.equal(out.rubrics[0].score, 80)
    assert.equal(out.rubrics[1].score, null)
  })

  it('keeps the first rubric when names repeat', () => {
    const raw = {
      rubrics: [
        { name: 'MESSAGE', score: 80, assessmentState: 'ASSESSED' },
        { name: 'MESSAGE', score: 20, assessmentState: 'ASSESSED' },
      ],
    }
    const out = normalizeTriageRawOutput(raw) as { rubrics: Array<Record<string, unknown>> }
    assert.equal(out.rubrics[0].score, 80)
  })

  it('fills placeholders for missing rubrics in rubric order', () => {
    const out = normalizeTriageRawOutput({ rubrics: [] }) as {
      rubrics: Array<Record<string, unknown>>
    }
    assert.deepEqual(
      out.rubrics.map((r) => r.name),
      ['MESSAGE', 'EXPERIENCE', 'REACH']
    )
    assert.equal(out.rubrics[0].grade, 'F')
    assert.equal(out.rubrics[0].assessmentState, 'UNKNOWN')
    assert.equal(out.rubrics[0].score, null)
  })
})

describe('runTriageWithRetry provider paths', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('rejects unknown providers', async () => {
    runAttempt('gemini')
    await assert.rejects(
      () =>
        runTriageWithRetry('https://example.com', METADATA, null, null, FLAGS, null, null),
      /Unknown triage provider/
    )
  })

  it('runs an OpenAI triage with screenshot content', async () => {
    runAttempt('openai', { desktopBase64: 'aGVsbG8=' })
    mocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(VALID_OUTPUT) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    })
    const result = await runTriageWithRetry(
      'https://example.com',
      METADATA,
      null,
      null,
      FLAGS,
      'aGVsbG8=',
      null
    )
    assert.equal(result.output.score, 72)
    assert.equal(result.usage.inputTokens, 10)
    assert.equal(result.usage.outputTokens, 5)
    const createArgs = mocks.openaiCreate.mock.calls[0][0]
    assert.equal(createArgs.model, 'gpt-4o-mini')
    assert.equal(createArgs.messages[1].content[0].type, 'image_url')
  })

  it('throws when the OpenAI response has no content', async () => {
    runAttempt('openai')
    mocks.openaiCreate.mockResolvedValue({ choices: [{ message: { content: null } }] })
    await assert.rejects(
      () => runTriageWithRetry('https://example.com', METADATA, null, null, FLAGS, null, null),
      /No content in triage response/
    )
  })

  it('throws when the OpenAI response content is malformed JSON', async () => {
    runAttempt('openai')
    mocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'not-json' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    })
    await assert.rejects(
      () => runTriageWithRetry('https://example.com', METADATA, null, null, FLAGS, null, null),
      /Unexpected token/
    )
  })

  it('runs an Anthropic triage and reads tool usage', async () => {
    runAttempt('anthropic', { desktopBase64: 'aGVsbG8=', mobileBase64: 'd29ybGQ=' })
    mocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'tool_use', input: VALID_OUTPUT }],
      usage: {
        input_tokens: 20,
        output_tokens: 8,
        cache_read_input_tokens: 12,
        cache_creation_input_tokens: 4,
      },
    })
    const result = await runTriageWithRetry(
      'https://example.com',
      METADATA,
      null,
      null,
      FLAGS,
      'aGVsbG8=',
      'd29ybGQ='
    )
    assert.equal(result.output.score, 72)
    assert.equal(result.usage.cacheReadTokens, 12)
    assert.equal(result.usage.cacheWriteTokens, 4)
    const createArgs = mocks.anthropicCreate.mock.calls[0][0]
    assert.equal(createArgs.messages[0].content[0].type, 'image')
    assert.equal(createArgs.messages[0].content[1].type, 'image')
    // Cache control on the system block for prompt-cache reuse.
    assert.equal(createArgs.system[0].cache_control.type, 'ephemeral')
  })

  it('throws when the Anthropic response has no tool use', async () => {
    runAttempt('anthropic')
    mocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'hello' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    await assert.rejects(
      () => runTriageWithRetry('https://example.com', METADATA, null, null, FLAGS, null, null),
      /No tool_use in triage response/
    )
  })

  it('passes deterministic flags into the triage attempt', async () => {
    let seenContext: Record<string, unknown> | null = null
    mocks.runLlmWithRetry.mockImplementation(
      async ({ attemptFn, input }: { attemptFn: (p: string, i: Record<string, unknown>) => Promise<unknown>; input: Record<string, unknown> }) => {
        seenContext = input.context as Record<string, unknown>
        return attemptFn('openai', input)
      }
    )
    mocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(VALID_OUTPUT) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    })
    await runTriageWithRetry('https://example.com', METADATA, null, null, FLAGS, null, null)
    expect(((seenContext ?? {}) as { deterministicFlags?: unknown[] }).deterministicFlags).toHaveLength(1)
  })
})

describe('triage output schema', () => {
  it('accepts the valid output fixture', () => {
    const parsed = triageOutputSchema.safeParse(VALID_OUTPUT)
    assert.equal(parsed.success, true)
  })
})

import { expect } from 'vitest'
void expect
