import { gradeRank, severityRank } from '@/lib/utils'
import type { FixConfidence, RankableFlag } from './flag-types'
import type { ProductContract } from './product-contract'

export type { FixConfidence, RankableFlag } from './flag-types'

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
  // Secondary critical-path pages get ::page:N suffixes
  if (checkId.includes('::page:')) return 1
  return 2
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

function compareFlagPrioritySignals(
  a: RankableFlag,
  b: RankableFlag,
  contract?: ProductContract | null
): number {
  const severityDiff = severityRank(a.severity) - severityRank(b.severity)
  if (severityDiff !== 0) return severityDiff

  const alignmentDiff =
    Math.min(contractAlignmentBoost(a, contract), corridorBoost(a)) -
    Math.min(contractAlignmentBoost(b, contract), corridorBoost(b))
  if (alignmentDiff !== 0) return alignmentDiff

  const impactDiff = impactRank(a.impactTag) - impactRank(b.impactTag)
  if (impactDiff !== 0) return impactDiff

  const confidenceDiff = confidenceRank(b.confidence) - confidenceRank(a.confidence)
  if (confidenceDiff !== 0) return confidenceDiff

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
  return candidates.find((prompt) => prompt?.trim())?.trim() ?? null
}

export function flagHasFixPrompt(flag: RankableFlag): boolean {
  return resolveFixPrompt(flag) !== null
}

export function auditHasFixPrompts(flags: RankableFlag[]): boolean {
  return flags.some(flagHasFixPrompt)
}

export function getTopFixPromptFromFlags(
  flags: RankableFlag[]
): { prompt: string; flag?: string } | null {
  const sorted = [...flags].sort(compareFlagsByPriority)

  for (const flag of sorted) {
    const prompt = resolveFixPrompt(flag)
    if (prompt) {
      return { prompt, flag: flag.problem }
    }
  }
  return null
}

export function collectFixPromptsByRubric(
  flags: RankableFlag[],
  rubric: string
): string {
  const rubricFlags = flags.filter((f) => f.rubric === rubric)
  const sorted = [...rubricFlags].sort(compareFlagsByPriority)
  const label = rubric.charAt(0) + rubric.slice(1).toLowerCase()
  const parts: string[] = []
  let index = 0
  for (const flag of sorted) {
    const prompt = resolveFixPrompt(flag)
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

export function collectAllFixPrompts(flags: RankableFlag[]): string {
  const sorted = [...flags].sort(compareFlagsByPriority)
  const parts: string[] = []
  let index = 0
  for (const flag of sorted) {
    const prompt = resolveFixPrompt(flag)
    if (prompt) {
      index++
      parts.push(`=== Fix ${index}: ${flag.problem} ===\n${prompt}`)
    }
  }
  return parts.join('\n\n')
}

function titleCaseRubric(rubric: string): string {
  return rubric.charAt(0).toUpperCase() + rubric.slice(1).toLowerCase()
}

export function fixConfidenceLabel(confidence: string | null | undefined): string {
  if (confidence === 'HIGH') return 'HIGH'
  if (confidence === 'MEDIUM') return 'MEDIUM'
  if (confidence === 'LOW') return 'LOW'
  return 'MEDIUM'
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
 * Build a structured goal-loop prompt with 3 phases (Research → Plan → Fix).
 * Defaults to the deprecated Quick Plan (up to three highest-leverage issues). Explicit all-prompt
 * exports use buildAllFixPrompts instead of changing this contract.
 */
export function buildPlanModePrompt(
  flags: RankableFlag[],
  options: {
    url?: string | null
    limit?: number
    contract?: ProductContract | null
  } = {}
): string {
  const limit = options.limit === undefined ? 3 : options.limit
  const ranked = rankFlagsByPriority(flags, [], limit, options.contract).map((r) => r.flag)

  const items: string[] = []
  const byConfidence: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const flag of ranked) {
    const prompt = resolveFixPrompt(flag)
    if (!prompt) continue
    const confidence = resolveFixConfidence(flag)
    byConfidence[confidence]++
    const tag = `[${flag.severity} · ${titleCaseRubric(flag.rubric)} · ${confidence}]`
    const lines = [`${items.length + 1}. ${tag} ${flag.problem}`]
    if (flag.evidence?.trim()) lines.push(`   Evidence: ${flag.evidence.trim()}`)
    lines.push(`   Fix: ${prompt.replace(/\n/g, '\n   ')}`)
    items.push(lines.join('\n'))
  }
  if (items.length === 0) return ''

  const site = options.url?.trim()
  const target = site ? ` of ${site}` : ''
  const count = items.length
  const noun = count === 1 ? 'issue' : 'issues'
  const highCount = byConfidence.HIGH
  const mediumCount = byConfidence.MEDIUM
  const lowCount = byConfidence.LOW

  const header = [
    `## Mission`,
    `Fix all ${count} ${noun} for${target}. Architecture stays the same; only fix the specific issues listed below. After each fix, deploy and verify.`,
    '',
    '## Confidence keys',
    `- HIGH (${highCount}): Deterministic check, one-line change, low regression risk. Safe to apply.`,
    `- MEDIUM (${mediumCount}): Requires understanding context or spans multiple lines. Review the diff.`,
    `- LOW (${lowCount}): Significant refactor or copy rewrite. Human review strongly recommended before merging.`,
    '',
    '## Phase 1: Research (read-only)',
    'For each issue, open the relevant file(s) and confirm the problem exists. Name each file you inspect. Do not change any files yet.',
    '',
    '## Phase 2: Plan',
    'Group related issues by file or component. Order the work by user impact, starting with anything that blocks a visitor. Note any dependencies between fixes. Call out anything ambiguous or risky. Then wait for my go-ahead before editing.',
    '',
    '## Phase 3: Fix (one issue at a time)',
    'Fix HIGH-confidence issues first. After each fix: deploy and verify the issue is resolved. If a fix does not clear on re-check, backtrack to the previous state and try an alternative approach. Flag any fix that requires more than 2 attempts for human review.',
    '',
    `Issues (ordered by priority):`,
  ].join('\n')

  return `${header}\n\n${items.join('\n\n')}`
}

export function countFixPrompts(flags: RankableFlag[]): number {
  return flags.filter(flagHasFixPrompt).length
}

export function rankFlagsByPriority(
  flags: RankableFlag[],
  rubricRows: Array<{ name: string; grade: string | null }> = [],
  limit = 3,
  contract?: ProductContract | null
): Array<{ flag: RankableFlag; rubricName: string; rubricGrade: string | null }> {
  const gradeByRubric = new Map(rubricRows.map((row) => [row.name, row.grade]))
  const ranked = flags.map((flag) => ({
    flag,
    rubricName: flag.rubric,
    rubricGrade: gradeByRubric.get(flag.rubric) ?? null,
  }))

  ranked.sort((a, b) => {
    const priorityDiff = compareFlagPrioritySignals(a.flag, b.flag, contract)
    if (priorityDiff !== 0) return priorityDiff

    const gradeDiff = gradeRank(a.rubricGrade ?? '') - gradeRank(b.rubricGrade ?? '')
    if (gradeDiff !== 0) return gradeDiff

    return a.flag.problem.localeCompare(b.flag.problem)
  })

  return ranked.slice(0, limit)
}
