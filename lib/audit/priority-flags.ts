import { gradeRank, severityRank } from '@/lib/utils'

export interface RankableFlag {
  id: string
  checkId?: string | null
  rubric: string
  severity: string
  impactTag?: string | null
  problem: string
  evidence?: string
  whyItMatters?: string
  fix?: string
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  verificationRule?: string | null
  pageUrl?: string | null
  confidence?: number | null
}

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
