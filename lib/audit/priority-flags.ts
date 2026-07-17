import { gradeRank, severityRank } from '@/lib/utils'
import type { RankableFlag } from './flag-types'

export type { RankableFlag } from './flag-types'

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

function impactRank(impactTag: string | null | undefined): number {
  return impactTag ? IMPACT_PRIORITY[impactTag] ?? 99 : 99
}

function confidenceRank(confidence: number | null | undefined): number {
  return typeof confidence === 'number' ? confidence : 0
}

function compareFlagPrioritySignals(a: RankableFlag, b: RankableFlag): number {
  const severityDiff = severityRank(a.severity) - severityRank(b.severity)
  if (severityDiff !== 0) return severityDiff

  const impactDiff = impactRank(a.impactTag) - impactRank(b.impactTag)
  if (impactDiff !== 0) return impactDiff

  const confidenceDiff = confidenceRank(b.confidence) - confidenceRank(a.confidence)
  if (confidenceDiff !== 0) return confidenceDiff

  return 0
}

export function compareFlagsByPriority(a: RankableFlag, b: RankableFlag): number {
  const signalDiff = compareFlagPrioritySignals(a, b)
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

/**
 * One prompt that turns the whole report into a plan-mode task for an AI editor
 * (Cursor, Claude Code). Paste it, put the editor in plan mode, and it produces a
 * prioritized fix plan instead of editing blindly. Every flag with a fix prompt is
 * included, ranked by priority, with its evidence and copy-ready fix guidance.
 * Returns an empty string when no flag has a usable fix prompt.
 */
export function buildPlanModePrompt(
  flags: RankableFlag[],
  options: { url?: string | null } = {}
): string {
  const sorted = [...flags].sort(compareFlagsByPriority)
  const items: string[] = []
  for (const flag of sorted) {
    const prompt = resolveFixPrompt(flag)
    if (!prompt) continue
    const tag = `[${flag.severity} · ${titleCaseRubric(flag.rubric)}]`
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

  const header = [
    `This is a QA review${target}. It found ${count} ${noun} to fix. Work in plan mode: do not change any files yet.`,
    '',
    'First, write a fix plan:',
    '- Group related issues so they can be fixed together.',
    '- Order the work by user impact, starting with anything that blocks a visitor.',
    '- For each group, name the file or component you expect to change and any decision you need from me.',
    '- Call out anything ambiguous or risky before touching it.',
    '',
    'Then stop and wait for my go-ahead before editing. After the fixes are in, I will re-check the same URL to confirm each issue is cleared.',
    '',
    `Issues to plan around:`,
  ].join('\n')

  return `${header}\n\n${items.join('\n\n')}`
}

export function countFixPrompts(flags: RankableFlag[]): number {
  return flags.filter(flagHasFixPrompt).length
}

export function rankFlagsByPriority(
  flags: RankableFlag[],
  rubricRows: Array<{ name: string; grade: string | null }> = [],
  limit = 3
): Array<{ flag: RankableFlag; rubricName: string; rubricGrade: string | null }> {
  const gradeByRubric = new Map(rubricRows.map((row) => [row.name, row.grade]))
  const ranked = flags.map((flag) => ({
    flag,
    rubricName: flag.rubric,
    rubricGrade: gradeByRubric.get(flag.rubric) ?? null,
  }))

  ranked.sort((a, b) => {
    const priorityDiff = compareFlagPrioritySignals(a.flag, b.flag)
    if (priorityDiff !== 0) return priorityDiff

    const gradeDiff = gradeRank(a.rubricGrade ?? '') - gradeRank(b.rubricGrade ?? '')
    if (gradeDiff !== 0) return gradeDiff

    return a.flag.problem.localeCompare(b.flag.problem)
  })

  return ranked.slice(0, limit)
}
