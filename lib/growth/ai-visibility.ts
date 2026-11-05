import { PUBLIC_OFFER } from '@/lib/marketing/copy/public-offer'
import { MCP_IS_DISCOVERABLE } from '@/lib/mcp/discoverability'
import { AI_FACT_REVIEW_SOURCES, AI_VISIBILITY_PROMPTS } from './ai-visibility-prompts'

const PLATFORMS = ['chatgpt', 'google-ai', 'perplexity', 'claude', 'copilot', 'other'] as const
const JUDGMENTS = ['supported', 'contradicted', 'not-addressed', 'unreviewed'] as const
const REVIEW_KEYS = ['offer', 'mcp', 'capabilities'] as const
const invalid = () => { throw new Error('Invalid public observation dataset') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) invalid()
}
function publicCitation(value: unknown) {
  if (typeof value !== 'string' || value.length > 2000) return invalid()
  let url: URL
  try { url = new URL(value) } catch { return invalid() }
  // URLs are validated locally and never fetched, serialized or persisted.
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(url.hostname) ||
      /(?:^|\.)(localhost|local|internal|test|invalid|example)$/.test(url.hostname) ||
      /^\/(?:api|dashboard|admin|settings|share|report|sign-in|sign-up)(?:\/|$)/i.test(url.pathname)) invalid()
  return url.hostname === 'fixflags.com' || url.hostname === 'www.fixflags.com'
}

/** Only recorded public brand answers enter this offline evaluator. No model/provider calls. */
export function evaluateAiVisibility(input: unknown, now = new Date()) {
  const dataset = record(input)
  exactKeys(dataset, ['publicBrandAnswersOnly', 'observations'])
  if (dataset.publicBrandAnswersOnly !== true || !Array.isArray(dataset.observations) || dataset.observations.length > 5000) invalid()
  const observations = dataset.observations as unknown[]
  const knownIds = new Set<string>(AI_VISIBILITY_PROMPTS.map(([id]) => id))
  const seen = new Set<string>()
  const covered = new Set<string>()
  const dates: string[] = []
  const platforms = new Set<string>()
  let mentions = 0
  let citedAnswers = 0
  let brandCitedAnswers = 0
  const reviewerJudgment = Object.fromEntries(REVIEW_KEYS.map((key) => [key, { supported: 0, contradicted: 0, 'not-addressed': 0, unreviewed: 0 }]))
  for (const raw of observations) {
    const observation = record(raw)
    exactKeys(observation, ['promptId', 'platform', 'model', 'observedAt', 'answer', 'citationUrls', 'review'])
    const { promptId, platform, model, observedAt, answer, citationUrls } = observation
    if (typeof promptId !== 'string' || !knownIds.has(promptId) || typeof platform !== 'string' || !PLATFORMS.includes(platform as typeof PLATFORMS[number]) ||
        typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9 ._:/-]{0,99}$/.test(model) ||
        typeof observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(observedAt) ||
        !Number.isFinite(Date.parse(observedAt)) || new Date(observedAt).toISOString().slice(0, 10) !== observedAt.slice(0, 10) || Date.parse(observedAt) > now.getTime() ||
        typeof answer !== 'string' || !answer.trim() || answer.length > 100000 || !Array.isArray(citationUrls) || citationUrls.length > 100) invalid()
    const key = JSON.stringify([promptId, platform, model, observedAt])
    if (seen.has(key)) invalid()
    seen.add(key)
    covered.add(promptId as string)
    dates.push(observedAt as string)
    platforms.add(platform as string)
    if (/\bfix\s?flags\b/i.test(answer as string)) mentions++
    const citations = (citationUrls as unknown[]).map(publicCitation)
    if (citations.length) citedAnswers++
    if (citations.some(Boolean)) brandCitedAnswers++
    const review = observation.review === undefined ? {} : record(observation.review)
    exactKeys(review, REVIEW_KEYS)
    for (const fact of REVIEW_KEYS) {
      const judgment = review[fact] ?? 'unreviewed'
      if (!JUDGMENTS.includes(judgment as typeof JUDGMENTS[number])) invalid()
      reviewerJudgment[fact][judgment as typeof JUDGMENTS[number]]++
    }
  }
  dates.sort((left, right) => Date.parse(left) - Date.parse(right))
  return {
    datasetVersion: 'fixflags-public-ai-visibility-v1',
    evaluatedAt: now.toISOString(),
    source: 'User-recorded public model answers; not independently retrieved or authenticated',
    observationWindow: dates.length ? { firstObservedAt: dates[0], lastObservedAt: dates[dates.length - 1] } : null,
    platforms: [...platforms].sort(),
    coverage: { expectedPrompts: AI_VISIBILITY_PROMPTS.length, observedPrompts: covered.size, observations: observations.length, status: covered.size === AI_VISIBILITY_PROMPTS.length ? 'complete' : observations.length ? 'partial' : 'unavailable' },
    observable: observations.length ? { brandMentionAnswers: mentions, answersWithCitations: citedAnswers, answersCitingFixFlags: brandCitedAnswers } : null,
    factualChecks: { status: 'manual-review-required', sources: AI_FACT_REVIEW_SOURCES, currentWorkspaceReference: { offer: PUBLIC_OFFER, mcpDiscoverable: MCP_IS_DISCOVERABLE }, reviewerJudgment: observations.length ? reviewerJudgment : null },
    prompts: AI_VISIBILITY_PROMPTS.map(([id, category]) => ({ id, category, status: covered.has(id) ? 'observed' : 'unavailable' })),
    limitations: [
      'Mentions use a literal brand-name match. Citations are user-recorded URL syntax checks, not fetched evidence or proof a source supports an answer.',
      'Reviewer judgments are separate from observable counts. Pricing, beta, MCP availability and capability claims require manual checking against canonical source files at observation time. The current workspace reference is not historical or deployment proof.',
      'Platform, model and date are required on every input. Only finite platform labels and aggregate dates are emitted; raw model labels, answers and URLs are withheld.',
      'Coverage counts prompts, not customers. Repeated observations are not independent demand evidence or causal ranking effects. No paid model calls, indexing or ranking proof.',
      'Raw input must contain only public brand-answer material, never customer prompts, private findings, identities or URLs. No raw input is persisted by this evaluator.',
    ],
  }
}
