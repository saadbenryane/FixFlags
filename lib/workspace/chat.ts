import OpenAI from 'openai'
import { openai } from '@/lib/audit/judge-runner'
import { getChatProviderConfig } from '@/lib/audit/judge-config'
import { getOpenAIProviderKey } from '@/lib/audit/llm-keys'
import { getEnv } from '@/lib/env'
import { RUBRIC_ORDER, type RubricName } from '@/lib/audit/constants'
import {
  compareFlagsByPriority,
  flagHasFixPrompt,
  type RankableFlag,
} from '@/lib/audit/priority-flags'
import { rubricLabel } from '@/lib/utils'

type OpenAIClient = NonNullable<typeof openai>

/**
 * Chat uses its own OpenAI-compatible client when CHAT_BASE_URL routes chat
 * through a gateway (for example the opencode gateway). Otherwise it shares
 * the configured OpenAI client. Kept in one place so chat never couples to
 * judge or triage provider configuration.
 */
function getChatOpenAIClient(): OpenAIClient | null {
  const baseURL = getEnv().CHAT_BASE_URL
  if (baseURL) {
    const key = getOpenAIProviderKey()
    return key ? new OpenAI({ apiKey: key, baseURL }) : null
  }
  return openai ?? null
}

export function isWorkspaceChatConfigured(): boolean {
  return Boolean(getChatOpenAIClient())
}

export class WorkspaceChatUnavailableError extends Error {
  constructor() {
    super('Workspace chat is unavailable')
  }
}

const MAX_CHAT_TOKENS = 600

function buildPrompt(input: {
  message: string
  url: string
  status: string
  flags: ChatFlagContext[]
}) {
  return `Report URL: ${input.url}\nStatus: ${input.status}\n\nFlags on this report:\n${formatFlagContext(input.flags)}\n\nUser: ${input.message}`
}

/**
 * A conservative provider-independent upper bound. BPE tokenizers cannot
 * produce more tokens than the UTF-8 byte stream they encode; the response is
 * separately hard-capped. Reserving this amount prevents concurrent requests
 * from overspending an account before provider usage is known.
 */
export function workspaceChatTokenUpperBound(input: {
  message: string
  url: string
  status: string
  flags: ChatFlagContext[]
}): number {
  const bytes = new TextEncoder().encode(`${SYSTEM}\n${buildPrompt(input)}`).byteLength
  return bytes + MAX_CHAT_TOKENS + 32
}

async function runOpenAIChat(
  client: OpenAIClient,
  input: {
    message: string
    url: string
    status: string
    flags: ChatFlagContext[]
  }
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const cfg = getChatProviderConfig('openai', 15_000)
  const response = await client.chat.completions.create({
    model: cfg.model,
    max_tokens: Math.min(cfg.maxTokens, MAX_CHAT_TOKENS),
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: buildPrompt(input),
      },
    ],
  })

  const text = response.choices[0]?.message?.content?.trim() ?? ''
  return {
    text,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}

export interface ChatFlagContext {
  id: string
  rubric: string
  severity: string
  problem: string
  evidence: string
  fix: string
  checkId?: string | null
  /** FlagStatus: OPEN | FIXED | IGNORED | REGRESSED. Undefined in fixtures means open. */
  status?: string | null
  position?: number
}

const SYSTEM = `You are FixFlags workspace chat. Help the builder understand Flags on their product review report.
Stay concise. Do not invent findings. Suggest what to fix first when asked.
You are not running a new scan. Only explain and steer based on the report context provided.
When the user asks about a Flag, ground your answer in the report context: rank by severity, reference the evidence, and offer the matching fix prompt.`

function formatFlagContext(flags: ChatFlagContext[]): string {
  if (flags.length === 0) return 'No Flags on this report yet.'
  return flags
    .map(
      (flag, index) =>
        `${index + 1}. [${flag.rubric}] ${flag.problem.slice(0, 400)}\n   Severity: ${flag.severity}\n   Evidence: ${flag.evidence.slice(0, 400)}\n   Fix: ${flag.fix.slice(0, 400)}`
    )
    .join('\n')
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

/**
 * Deterministic canned reply built from the report's own Flags. Used when no
 * chat provider is configured or the model call fails, so chat degrades to
 * useful canned actions instead of a dead end.
 */
export function buildCannedChatReply(input: { flags: ChatFlagContext[] }): string {
  const flags = input.flags
  if (flags.length === 0) {
    return 'No Flags on this report yet. Open a Flag in the report for evidence and fix prompts.'
  }
  const top = [...flags].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )[0]
  return [
    `Start with the most important Flag: ${top.problem}`,
    `Evidence: ${top.evidence}`,
    `Fix: ${top.fix}`,
  ].join('\n\n')
}

/* ------------------------------------------------------------------ */
/* Product-grounded deterministic answers                              */
/*                                                                    */
/* The four product-level question types are answered deterministically
 * from real persisted data (observation flags, re-check diff summary,
 * verified learnings) so the workspace chat never invents product facts.
 * The LLM path (runWorkspaceChat) stays for open-ended questions only. */
/* ------------------------------------------------------------------ */

export type ProductQuestionKind = 'changed' | 'verified' | 'unresolved' | 'fix-first'

export interface ChatDiffItem {
  problem: string
  rubric: string
  severity: string
}

/**
 * Diff state between an observation audit and its parent review, computed
 * from real persisted flags via lib/audit/diff-flags.ts. Buckets follow the
 * re-check diff: fixed = verified fixed, newIssues = new, regressed = regressed.
 */
export interface ChatDiffSummary {
  hasParent: boolean
  fixed: ChatDiffItem[]
  regressed: ChatDiffItem[]
  newIssues: ChatDiffItem[]
}

export interface ChatVerifiedLearning {
  summary: string
  checkId?: string | null
  at?: string
}

export interface ChatProductQuestionInput {
  message: string
  flags: ChatFlagContext[]
  diff: ChatDiffSummary
  learnings: ChatVerifiedLearning[]
  /** Human hostname of the product, for example example.com. */
  productName?: string
}

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const FIX_FIRST_PHRASES = [
  'fix first',
  'what to fix',
  'what do i fix',
  'what should i fix',
  'where do i start',
  'where should i start',
  'start with',
  'most important',
  'top priority',
  'first priority',
  'highest priority',
  'what matters most',
  'prioritize',
]

const CHANGED_PHRASES = [
  'what changed',
  'whats changed',
  'what has changed',
  'what was fixed',
  'what got fixed',
  'what has been fixed',
  'what was resolved',
  'what got resolved',
  'since the last review',
  'since last review',
  'since the previous review',
  'since my last review',
  'since the update review',
  'since the last check',
  'since the last run',
  'what is new',
  'whats new',
  'new flags',
  'what is different',
  'whats different',
  'did anything change',
  'did it change',
  'how did it change',
  'any changes',
  'changes since',
  'anything new',
  'any improvement',
  'what improved',
  'improve since',
  'what is fixed',
  'whats fixed',
]

const UNRESOLVED_PHRASES = [
  'unresolved',
  'still open',
  'what is left',
  'whats left',
  'what is remaining',
  'whats remaining',
  'what remains',
  'open flags',
  'outstanding',
  'still not fixed',
  'not fixed yet',
  'not yet fixed',
  'what needs work',
  'remaining issues',
  'remaining flags',
  'what is still failing',
  'whats still failing',
  'what still fails',
  'whats outstanding',
]

const VERIFIED_LEAD_RE = /^(?:is|are|has|have|was|were|did)\b/
const VERIFIED_TRAIL_RE =
  /\b(?:verified|fixed|resolved|confirmed)\s*(?:yet|now|already|at all|or not)?\??$/

function isVerifiedQuestion(normalized: string): boolean {
  if (!VERIFIED_LEAD_RE.test(normalized)) return false
  return VERIFIED_TRAIL_RE.test(normalized) || normalized.includes(' verified')
}

const GENERIC_SUBJECTS = new Set([
  'anything',
  'everything',
  'something',
  'nothing',
  'it',
  'any',
])

/**
 * Pull the flag subject out of a verified question, for example
 * "is the cta contrast fixed" -> "cta contrast". Returns null when the
 * question has no specific subject ("is anything verified").
 */
export function extractVerifiedSubject(message: string): string | null {
  const normalized = normalizeMessage(message)
  const lead = normalized.match(/^(?:is|are|has|have|was|were|did)\s+(.+)$/)
  if (!lead) return null
  let subject = lead[1]!
  const trail = subject.match(
    /^(.*?)\s+(?:verified|fixed|resolved|confirmed)(?:\s+(?:yet|now|already|at all|or not))?\??$/
  )
  if (trail) subject = trail[1]!
  const cleaned = subject
    .replace(/^(?:the|a|an|my|our|this|that|their)\s+/, '')
    .replace(
      /^(?:it|they|these|those|we|you|i)\s+(?:were|was|have|has|did|are|is)\s+(?:been\s+)?/,
      ''
    )
    .replace(/\s+(?:been|flag|flags|issue|issues|problem|problems)\s*$/, '')
    .trim()
  if (cleaned.length < 2 || GENERIC_SUBJECTS.has(cleaned)) return null
  return cleaned
}

function subjectWords(subject: string): Set<string> {
  return new Set(
    subject
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
  )
}

function findFlagForSubject(
  subject: string,
  flags: ChatFlagContext[]
): ChatFlagContext | null {
  const subjectText = subject.toLowerCase()
  const words = subjectWords(subjectText)
  let best: { flag: ChatFlagContext; score: number } | null = null
  for (const flag of flags) {
    if (subjectText.includes(flag.id)) return flag
    if (flag.checkId && subjectText.includes(flag.checkId.toLowerCase())) return flag
    const problem = flag.problem.toLowerCase()
    let score = 0
    for (const word of words) {
      if (problem.includes(word)) score += 1
    }
    if (subjectText.length >= 3 && problem.includes(subjectText)) score += 2
    if (score > (best?.score ?? 0)) best = { flag, score }
  }
  return best && best.score >= 2 ? best.flag : null
}

function findLearningForSubject(
  subject: string,
  learnings: ChatVerifiedLearning[]
): ChatVerifiedLearning | null {
  const subjectText = subject.toLowerCase()
  const words = subjectWords(subjectText)
  let best: { learning: ChatVerifiedLearning; score: number } | null = null
  for (const learning of learnings) {
    const summary = learning.summary.toLowerCase()
    let score = 0
    for (const word of words) {
      if (summary.includes(word)) score += 1
    }
    if (subjectText.length >= 3 && summary.includes(subjectText)) score += 2
    if (score > (best?.score ?? 0)) best = { learning, score }
  }
  return best && best.score >= 2 ? best.learning : null
}

function plainSeverity(severity: string): string {
  if (severity === 'CRITICAL') return 'Critical'
  if (severity === 'IMPORTANT') return 'Important'
  if (severity === 'POLISH') return 'Polish'
  return severity
}

function rubricOrderIndex(rubric: string): number {
  const index = RUBRIC_ORDER.indexOf(rubric as RubricName)
  return index === -1 ? RUBRIC_ORDER.length : index
}

/**
 * Deterministic rank for chat answers: canonical Finish Plan priority
 * signals (severity, contract alignment, impact, confidence), then rubric
 * order (Message, Experience, Reach), then fix availability, then position.
 */
export function rankObservationFlags(flags: ChatFlagContext[]): ChatFlagContext[] {
  return [...flags].sort((a, b) => {
    const priorityDiff = compareFlagsByPriority(a as RankableFlag, b as RankableFlag)
    if (priorityDiff !== 0) return priorityDiff
    const rubricDiff = rubricOrderIndex(a.rubric) - rubricOrderIndex(b.rubric)
    if (rubricDiff !== 0) return rubricDiff
    const fixDiff =
      Number(flagHasFixPrompt(b as RankableFlag)) - Number(flagHasFixPrompt(a as RankableFlag))
    if (fixDiff !== 0) return fixDiff
    return (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
  })
}

const MAX_LIST_ITEMS = 5

function shortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDiffItems(items: ChatDiffItem[]): string {
  const shown = items.slice(0, MAX_LIST_ITEMS)
  const lines = shown.map(
    (item) => `- [${rubricLabel(item.rubric)}, ${plainSeverity(item.severity)}] ${item.problem}`
  )
  const rest = items.length - shown.length
  if (rest > 0) lines.push(`and ${rest} more.`)
  return lines.join('\n')
}

function buildChangedReply(input: ChatProductQuestionInput): string {
  const { diff } = input
  if (!diff.hasParent) {
    const product = input.productName ? ` of ${input.productName}` : ''
    return `This is the first review${product} in this thread, so there is no earlier review to compare against yet. Run an update review to see what changes next time.`
  }
  const { fixed, regressed, newIssues } = diff
  if (fixed.length === 0 && regressed.length === 0 && newIssues.length === 0) {
    return 'No flags changed since the last review.'
  }
  const counts: string[] = []
  if (fixed.length > 0) counts.push(`${fixed.length} verified fixed`)
  if (newIssues.length > 0) counts.push(`${newIssues.length} new`)
  if (regressed.length > 0) counts.push(`${regressed.length} regressed`)
  const parts = [`Since the last review: ${counts.join(', ')}.`]
  if (fixed.length > 0) parts.push(`Verified fixed:\n${formatDiffItems(fixed)}`)
  if (newIssues.length > 0) parts.push(`New:\n${formatDiffItems(newIssues)}`)
  if (regressed.length > 0) parts.push(`Regressed:\n${formatDiffItems(regressed)}`)
  return parts.join('\n\n')
}

function buildVerifiedReply(input: ChatProductQuestionInput): string {
  const subject = extractVerifiedSubject(input.message)
  const flag = subject ? findFlagForSubject(subject, input.flags) : null
  const learning = subject ? findLearningForSubject(subject, input.learnings) : null

  if (flag) {
    const status = flag.status ?? 'OPEN'
    if (status === 'FIXED') {
      const clearedSinceLast =
        input.diff.hasParent &&
        input.diff.fixed.some((item) => item.problem === flag.problem)
      const lines = [`Yes. "${flag.problem}" is verified fixed in this review.`]
      if (clearedSinceLast) lines.push('It cleared since the last review.')
      if (learning) lines.push('This fix is also recorded in your verified learnings.')
      return lines.join('\n')
    }
    if (status === 'REGRESSED') {
      return `No. "${flag.problem}" regressed in this review and is failing again at ${plainSeverity(flag.severity)}.`
    }
    if (status === 'IGNORED') {
      return `"${flag.problem}" was ignored, so it has not been verified fixed.`
    }
    const lines = [
      `Not yet. "${flag.problem}" is still open (${plainSeverity(flag.severity)}, ${rubricLabel(flag.rubric)}).`,
    ]
    if (learning) {
      lines.push('It was verified fixed in an earlier update review, but it is open again in this review.')
    }
    if (flag.fix) lines.push(`Fix: ${flag.fix}`)
    return lines.join('\n')
  }

  if (learning) {
    const when = learning.at ? ` (recorded ${shortDate(learning.at)})` : ''
    return `Yes. This was verified fixed in an earlier update review${when}:\n${learning.summary}`
  }

  if (!subject) {
    const fixed = input.flags.filter((flag) => flag.status === 'FIXED')
    if (fixed.length === 0) {
      return 'No flags are verified fixed on this review yet.'
    }
    return `Verified fixed on this review:\n${fixed
      .map((flag) => `- ${flag.problem}`)
      .join('\n')}`
  }

  return `I could not find "${subject}" in this review. Ask about a flag from the fix list, or ask "What's unresolved?"`
}

function countBySeverity(flags: ChatFlagContext[]): {
  critical: number
  important: number
  polish: number
  other: number
} {
  const counts = { critical: 0, important: 0, polish: 0, other: 0 }
  for (const flag of flags) {
    if (flag.severity === 'CRITICAL') counts.critical += 1
    else if (flag.severity === 'IMPORTANT') counts.important += 1
    else if (flag.severity === 'POLISH') counts.polish += 1
    else counts.other += 1
  }
  return counts
}

function formatSeverityCounts(counts: {
  critical: number
  important: number
  polish: number
  other: number
}): string {
  const parts: string[] = []
  if (counts.critical > 0) parts.push(`${counts.critical} Critical`)
  if (counts.important > 0) parts.push(`${counts.important} Important`)
  if (counts.polish > 0) parts.push(`${counts.polish} Polish`)
  if (counts.other > 0) parts.push(`${counts.other} other`)
  if (parts.length === 0) return ''
  return `: ${parts.join(', ')}`
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`
}

function buildUnresolvedReply(input: ChatProductQuestionInput): string {
  const unresolved = input.flags.filter(
    (flag) => flag.status !== 'FIXED' && flag.status !== 'IGNORED'
  )
  if (unresolved.length === 0) {
    return 'No unresolved flags on this review.'
  }
  const ranked = rankObservationFlags(unresolved)
  const counts = formatSeverityCounts(countBySeverity(ranked))
  const summary = `${ranked.length} unresolved ${plural(ranked.length, 'flag')} on this review${counts}.`
  const items = ranked.slice(0, MAX_LIST_ITEMS).map((flag, index) => {
    const fixLine = flag.fix ? `   Fix: ${flag.fix}` : ''
    return `${index + 1}. [${rubricLabel(flag.rubric)}, ${plainSeverity(flag.severity)}] ${flag.problem}${fixLine ? `\n${fixLine}` : ''}`
  })
  return [summary, ...items].join('\n')
}

function buildFixFirstReply(input: ChatProductQuestionInput): string {
  const unresolved = input.flags.filter(
    (flag) => flag.status !== 'FIXED' && flag.status !== 'IGNORED'
  )
  if (unresolved.length === 0) {
    return 'No unresolved flags on this review, so there is nothing to fix right now.'
  }
  const ranked = rankObservationFlags(unresolved)
  const top = ranked[0]!
  const lines = [
    'Start with this flag:',
    `[${rubricLabel(top.rubric)}, ${plainSeverity(top.severity)}] ${top.problem}`,
    `Evidence: ${(top.evidence ?? '').slice(0, 240) || 'Evidence not available for this flag.'}`,
  ]
  if (top.fix) {
    lines.push(`Fix: ${top.fix}`)
  } else {
    lines.push('No fix prompt was generated for this flag yet.')
  }
  if (ranked.length > 1) {
    const next = ranked.slice(1, 3).map(
      (flag, index) =>
        `${index + 2}. [${rubricLabel(flag.rubric)}, ${plainSeverity(flag.severity)}] ${flag.problem}`
    )
    lines.push('', 'Then, in order:', ...next)
  }
  return lines.join('\n')
}

/**
 * Classify a message as one of the four product-level question types.
 * Order matters: fix-first and changed phrases are checked before verified
 * so shared words like "fix" do not misroute.
 */
export function classifyProductQuestion(message: string): ProductQuestionKind | null {
  const normalized = normalizeMessage(message)
  if (FIX_FIRST_PHRASES.some((phrase) => normalized.includes(phrase))) return 'fix-first'
  if (CHANGED_PHRASES.some((phrase) => normalized.includes(phrase))) return 'changed'
  if (UNRESOLVED_PHRASES.some((phrase) => normalized.includes(phrase))) return 'unresolved'
  if (isVerifiedQuestion(normalized)) return 'verified'
  return null
}

/**
 * Deterministic product-level answer computed from real persisted data.
 * Returns null for open-ended questions that should go to the LLM path.
 */
export function answerProductQuestion(
  input: ChatProductQuestionInput
): { kind: ProductQuestionKind; reply: string } | null {
  const kind = classifyProductQuestion(input.message)
  if (!kind) return null
  const reply =
    kind === 'changed'
      ? buildChangedReply(input)
      : kind === 'verified'
        ? buildVerifiedReply(input)
        : kind === 'unresolved'
          ? buildUnresolvedReply(input)
          : buildFixFirstReply(input)
  return { kind, reply }
}

export async function runWorkspaceChat(input: {
  message: string
  url: string
  status: string
  flags: ChatFlagContext[]
}): Promise<{
  reply: string
  mode: 'llm'
  usage: { inputTokens: number; outputTokens: number }
}> {
  const client = getChatOpenAIClient()
  if (!client) {
    throw new WorkspaceChatUnavailableError()
  }

  try {
    const result = await runOpenAIChat(client, input)
    if (result.text) {
      return {
        reply: result.text,
        mode: 'llm',
        usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      }
    }
  } catch (error) {
    if (error instanceof WorkspaceChatUnavailableError) throw error
    throw new WorkspaceChatUnavailableError()
  }

  throw new WorkspaceChatUnavailableError()
}
