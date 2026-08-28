import { gradeRank, severityRank } from '@/lib/utils'
import type { FixConfidence, RankableFlag } from './flag-types'
import type { ProductContract } from './product-contract'
import { buildPlanBundleHeader, formatPlanItem, buildEditorHandoffPrompt } from '@/lib/audit/editor-handoff'

export type { FixConfidence, RankableFlag } from './flag-types'
export { AGENT_COPY_LEAD } from '@/lib/audit/editor-handoff'

const IMPACT_PRIORITY: Record<string, number> = {
  REVENUE: 0,
  CONVERSION: 1,
  TRUST: 2,
  ACCESSIBILITY: 3,
  MEASUREMENT: 4,
  FRICTION: 5,
  SHARING: 6,
  SEO: 7,
  CLARITY: 8,
  AUTHORITY: 9,
  EMOTION: 10,
}

// Stable precedence for sibling checks whose impact/severity are otherwise
// identical. This keeps ranking independent of customer-facing problem copy
// while putting the broadest transport/browser protections first.
const CHECK_PRIORITY: Record<string, number> = {
  'security-hsts-missing': 0,
  'security-hsts-too-short': 1,
  'security-csp-missing': 2,
  'security-csp-unsafe-inline': 3,
  'security-content-type-options-missing': 4,
  'security-frame-options-missing': 5,
  'description-missing': 10,
  'broken-internal-links': 11,
}

function checkPriority(flag: RankableFlag): number {
  const checkId = (flag.checkId ?? '').split('::page:')[0]
  return CHECK_PRIORITY[checkId] ?? 99
}

function sourceReliabilityWeight(flag: RankableFlag): number {
  const checkId = (flag.checkId ?? '').split('::page:')[0]
  // Security-related checks are most reliable (deterministic, low false positive rate)
  const securityPrefixes = [
    'security-',
    'no-https',
    'no-privacy-policy',
    'cookie-consent',
    'console-errors',
  ]
  // Critical-path navigation and form checks are reliably deterministic
  const criticalPathPrefixes = [
    'flow-',
    'journey-',
    'scroll-',
    'tap-targets',
    'mobile-',
    'form-',
    'loading-',
    'motion-',
  ]
  // SEO/sharing/measurement checks have more variable reliability
  const variablePrefixes = [
    'security-csp-' ,
    'security-hsts-',
    'security-frame-options-',
    'security-content-type-options-',
    'security-headers-missing',
    'no-structured-data',
    'sitemap-missing',
    'robots-txt-missing',
    'indexing-failure',
    'soft-404',
    'robots-blocked',
    'noindex-meta',
    'canonical-mismatch',
    'visual-',
    'messaging-',
    'cta-focus',
    'cta-dead-link',
    'social-proof-unverifiable',
    'placeholder-copy',
    'template-default-copy',
    'unreplaced-template-token',
    'competing-ctas',
    'hierarchy-',
    'mobile-input-zoom',
    'mobile-cta-thumb-zone',
    'mobile-cta-weak-label',
    'mobile-load-delay-content',
    'perf-score-',
    'lcp-',
    'cls-',
    'inp-',
    'unused-js',
    'unused-css',
    'unoptimized-images',
    'render-blocking',
  ]

  // Lower number = more reliable = higher priority
  if (securityPrefixes.some((p) => checkId.startsWith(p))) return 0.8
  if (criticalPathPrefixes.some((p) => checkId.startsWith(p))) return 0.9
  if (variablePrefixes.some((p) => checkId === p || checkId.startsWith(p + '-'))) return 1.1
  return 1.0
}

function impactRank(impactTag: string | null | undefined): number {
  return impactTag ? IMPACT_PRIORITY[impactTag] ?? 99 : 99
}

function confidenceRank(confidence: number | null | undefined): number {
  return typeof confidence === 'number' ? confidence : 0
}

function corridorBoost(flag: RankableFlag): number {
  const checkId = flag.checkId ?? ''
  if (checkId.startsWith('flow-') || checkId.startsWith('journey-') || checkId.startsWith('scroll-')) {
    return 0
  }
  // Secondary reviewed pages used to get ::page:N suffixes
  if (checkId.includes('::page:')) return 1
  return 2
}

function affectedOutcomesBoost(flag: RankableFlag, contract: ProductContract | null | undefined): number {
  if (!contract) return 1
  const hay = `${flag.problem} ${flag.whyItMatters ?? ''} ${flag.checkId ?? ''}`.toLowerCase()
  const needles = [contract.purpose, contract.firstValueJourney, ...contract.criticalOutcomes]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)

  const hits = needles.filter((w) => hay.includes(w)).length
  if (hits >= 2) return 0.8  // Strong alignment with critical outcomes
  if (hits === 1) return 0.9  // Moderate alignment
  return 1.0  // No alignment boost
}

// Checks that fire on nearly every site and do not represent high-leverage
// actionable issues. Demoted in Finish Plan ranking so they don't dominate
// the top-3 on well-built sites where more specific findings matter more.
const NOISY_POLISH_CHECKS = new Set([
  'cookie-consent-absent',
  'skip-link-missing',
  'measurement-ga-gtm-posthog-missing',
  'no-structured-data',
  'security-csp-missing',
  'security-frame-options-missing',
  'security-content-type-options-missing',
  'security-headers-missing',
  'no-privacy-policy',
])

function noisyPolishDemotion(flag: RankableFlag): number {
  if (flag.severity === 'POLISH' && NOISY_POLISH_CHECKS.has(flag.checkId ?? '')) {
    return 1
  }
  return 0
}

/**
 * Demote Reach hardening headers in Finish Plan ranking only.
 * Keeps severity/status honest while preferring conversion/first-visit Flags in top 3.
 */
function reachHardeningDemotion(flag: RankableFlag): number {
  const checkId = (flag.checkId ?? '').split('::page:')[0]
  if (
    checkId.startsWith('security-hsts-') ||
    checkId.startsWith('security-csp-') ||
    checkId.startsWith('security-content-type-options-') ||
    checkId.startsWith('security-frame-options-') ||
    checkId === 'security-headers-missing'
  ) {
    return 1
  }
  return 0
}

/** Lower is better. Boost Flags whose text aligns with Product Contract / PI. */
function contractAlignmentBoost(
  flag: RankableFlag,
  contract: ProductContract | null | undefined
): number {
  if (!contract) return 1
  const hay = `${flag.problem} ${flag.whyItMatters ?? ''} ${flag.checkId ?? ''}`.toLowerCase()
  const needles = [
    contract.purpose,
    contract.firstValueJourney,
    ...contract.criticalOutcomes,
  ]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)

  const hits = needles.filter((w) => hay.includes(w)).length
  if (hits >= 1) return 0
  // Journey/flow already boosted via corridor; keep slight preference for conversion/trust
  if (flag.impactTag === 'CONVERSION' || flag.impactTag === 'REVENUE') return 0
  return 1
}

/**
 * Reach SEO / sharing / measurement hygiene is real, but it is not what a
 * visitor notices first. Demote it after severity so a Critical meta-description
 * Flag still beats an Important CTA Flag, while an Important headline Flag
 * beats an Important og:image Flag.
 */
function customerVisibleDemotion(flag: RankableFlag): number {
  const impact = (flag.impactTag ?? '').toUpperCase()
  if (impact === 'SEO' || impact === 'SHARING' || impact === 'MEASUREMENT') return 1
  return 0
}

function compareFlagPrioritySignals(
  a: RankableFlag,
  b: RankableFlag,
  contract?: ProductContract | null,
  frequencyA?: number,
  frequencyB?: number
): number {
  const demotionDiff = reachHardeningDemotion(a) - reachHardeningDemotion(b)
  if (demotionDiff !== 0) return demotionDiff

  const noisyDiff = noisyPolishDemotion(a) - noisyPolishDemotion(b)
  if (noisyDiff !== 0) return noisyDiff

  const severityDiff = severityRank(a.severity) - severityRank(b.severity)
  if (severityDiff !== 0) return severityDiff

  const visibleDiff = customerVisibleDemotion(a) - customerVisibleDemotion(b)
  if (visibleDiff !== 0) return visibleDiff

  const alignmentDiff =
    Math.min(contractAlignmentBoost(a, contract), corridorBoost(a), affectedOutcomesBoost(a, contract)) -
    Math.min(contractAlignmentBoost(b, contract), corridorBoost(b), affectedOutcomesBoost(b, contract))
  if (alignmentDiff !== 0) return alignmentDiff

  const reliabilityDiff = sourceReliabilityWeight(a) - sourceReliabilityWeight(b)
  if (reliabilityDiff !== 0) return reliabilityDiff

  const impactDiff = impactRank(a.impactTag) - impactRank(b.impactTag)
  if (impactDiff !== 0) return impactDiff

  const confidenceDiff = confidenceRank(b.confidence) - confidenceRank(a.confidence)
  if (confidenceDiff !== 0) return confidenceDiff

  const freqDiff = (frequencyA ?? 0) - (frequencyB ?? 0)
  if (freqDiff !== 0) return freqDiff

  const checkDiff = checkPriority(a) - checkPriority(b)
  if (checkDiff !== 0) return checkDiff

  return 0
}

export function compareFlagsByPriority(
  a: RankableFlag,
  b: RankableFlag,
  contract?: ProductContract | null
): number {
  const signalDiff = compareFlagPrioritySignals(a, b, contract)
  if (signalDiff !== 0) return signalDiff

  return a.problem.localeCompare(b.problem)
}

export function groupFlagsBySeverity(flags: RankableFlag[]): {
  critical: RankableFlag[]
  important: RankableFlag[]
  polish: RankableFlag[]
} {
  const sorted = [...flags].sort(compareFlagsByPriority)

  return {
    critical: sorted.filter((f) => f.severity === 'CRITICAL'),
    important: sorted.filter((f) => f.severity === 'IMPORTANT'),
    polish: sorted.filter((f) => f.severity === 'POLISH'),
  }
}

export function countFlags(flags: RankableFlag[]): {
  total: number
  critical: number
  important: number
  polish: number
} {
  const groups = groupFlagsBySeverity(flags)
  return {
    total: flags.length,
    critical: groups.critical.length,
    important: groups.important.length,
    polish: groups.polish.length,
  }
}

/** Legacy signup-gate strings that were wrongly persisted as Flag evidence/fix. */
export const LEGACY_LOCKED_PROMPT_TEXT = [
  'Sign up',
  'Create a free account to see evidence and fix prompts.',
  'Sign up to see why this matters and get a fix prompt for your editor.',
  'Sign up to get the fix prompt.',
  'Sign up to see verification steps.',
] as const

const LEGACY_LOCKED_PROMPT_SET = new Set<string>(LEGACY_LOCKED_PROMPT_TEXT)

/** True when text is a real editor prompt, not empty or a signup placeholder. */
export function isUsableFixPrompt(prompt: string | null | undefined): prompt is string {
  const trimmed = prompt?.trim()
  if (!trimmed) return false
  return !LEGACY_LOCKED_PROMPT_SET.has(trimmed)
}

export function resolveFixPrompt(flag: RankableFlag): string | null {
  // agentPrompt/tool-specific prompts are the AI-crafted, copy-paste-ready
  // instructions ("what users most often copy-paste into Cursor/Claude" -
  // see lib/prompts/system-prompt.ts). `fix` is a plain-English description
  // written for a human, not an agent, so it's only the last-resort fallback
  // for flags that haven't gone through AI prescription yet.
  const candidates = [
    flag.agentPrompt,
    flag.cursorPrompt,
    flag.claudePrompt,
    flag.windsurfPrompt,
    flag.lovablePrompt,
    flag.boltPrompt,
    flag.fix,
  ]
  for (const candidate of candidates) {
    if (isUsableFixPrompt(candidate)) return candidate.trim()
  }
  return null
}

export function flagHasFixPrompt(flag: RankableFlag): boolean {
  return resolveFixPrompt(flag) !== null
}

export function collectFixPromptsByRubric(
  flags: RankableFlag[],
  rubric: string,
  options: { url?: string | null; pageType?: string | null } = {}
): string {
  const rubricFlags = flags.filter((f) => f.rubric === rubric)
  const sorted = [...rubricFlags].sort(compareFlagsByPriority)
  const label = rubric.charAt(0) + rubric.slice(1).toLowerCase()
  const parts: string[] = []
  let index = 0
  for (const flag of sorted) {
    const prompt = buildEditorHandoffPrompt(flag, {
      url: options.url ?? flag.pageUrl,
      pageType: options.pageType,
    })
    if (prompt) {
      index++
      parts.push(`=== ${label}: Fix ${index}: ${flag.problem} ===\n${prompt}`)
    }
  }
  return parts.join('\n\n')
}

export function countFixPromptsByRubric(flags: RankableFlag[], rubric: string): number {
  return flags.filter((f) => f.rubric === rubric && flagHasFixPrompt(f)).length
}

export function collectAllFixPrompts(
  flags: RankableFlag[],
  options: { url?: string | null; pageType?: string | null } = {}
): string {
  const sorted = [...flags].sort(compareFlagsByPriority)
  const parts: string[] = []
  let index = 0
  for (const flag of sorted) {
    const prompt = buildEditorHandoffPrompt(flag, {
      url: options.url ?? flag.pageUrl,
      pageType: options.pageType,
    })
    if (prompt) {
      index++
      parts.push(`=== Fix ${index}: ${flag.problem} ===\n${prompt}`)
    }
  }
  return parts.join('\n\n')
}

export function resolveFixConfidence(flag: RankableFlag): FixConfidence {
  if (flag.fixConfidence && ['HIGH', 'MEDIUM', 'LOW'].includes(flag.fixConfidence)) {
    return flag.fixConfidence
  }
  if (flag.source === 'DETERMINISTIC') return 'HIGH'
  if (flag.severity === 'CRITICAL') return 'HIGH'
  if (flag.severity === 'POLISH') return 'LOW'
  return 'MEDIUM'
}

/**
 * Copyable agent prompt: finding lead, reviewed page, then ranked issues.
 * Defaults to every Flag that has a prompt. Pass `limit` only for transport-specific
 * Finish Plan truncation (MCP/CLI still use the legacy finish-plan builder).
 */
export function buildPlanModePrompt(
  flags: RankableFlag[],
  options: {
    url?: string | null
    pageType?: string | null
    limit?: number
    contract?: ProductContract | null
  } = {}
): string {
  const limit = options.limit === undefined ? flags.length : options.limit
  const ranked = rankFlagsByPriority(flags, [], limit, options.contract).map((r) => r.flag)
  const context = { url: options.url, pageType: options.pageType }

  const items: string[] = []
  for (const flag of ranked) {
    if (!resolveFixPrompt(flag)) continue
    const confidence = resolveFixConfidence(flag)
    items.push(formatPlanItem(flag, items.length + 1, context, confidence))
  }
  if (items.length === 0) return ''

  return `${buildPlanBundleHeader(context)}${items.join('\n\n')}`
}

export function countFixPrompts(flags: RankableFlag[]): number {
  return flags.filter(flagHasFixPrompt).length
}

export function rankFlagsByPriority<TFlag extends RankableFlag>(
  flags: TFlag[],
  rubricRows: Array<{ name: string; grade: string | null }> = [],
  limit = 3,
  contract?: ProductContract | null,
  frequencyMap?: Map<string, number>
): Array<{ flag: TFlag; rubricName: string; rubricGrade: string | null }> {
  const gradeByRubric = new Map(rubricRows.map((row) => [row.name, row.grade]))
  const ranked = flags.map((flag) => ({
    flag,
    rubricName: flag.rubric,
    rubricGrade: gradeByRubric.get(flag.rubric) ?? null,
    frequency: frequencyMap?.get(flag.checkId ?? '') ?? 0,
  }))

  ranked.sort((a, b) => {
    const priorityDiff = compareFlagPrioritySignals(
      a.flag,
      b.flag,
      contract,
      a.frequency,
      b.frequency
    )
    if (priorityDiff !== 0) return priorityDiff

    const gradeDiff = gradeRank(a.rubricGrade ?? '') - gradeRank(b.rubricGrade ?? '')
    if (gradeDiff !== 0) return gradeDiff

    return a.flag.problem.localeCompare(b.flag.problem)
  })

  return ranked.slice(0, limit).map(({ flag, rubricName, rubricGrade }) => ({
    flag,
    rubricName,
    rubricGrade,
  }))
}
