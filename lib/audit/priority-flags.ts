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

export type SeverityGroup = 'CRITICAL' | 'IMPORTANT' | 'POLISH'

export interface FlagSeverityGroups {
  critical: RankableFlag[]
  important: RankableFlag[]
  polish: RankableFlag[]
}

export function groupFlagsBySeverity(flags: RankableFlag[]): FlagSeverityGroups {
  const sorted = [...flags].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity)
  )

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
  const candidates = [
    flag.fix,
    flag.lovablePrompt,
    flag.boltPrompt,
    flag.cursorPrompt,
    flag.claudePrompt,
    flag.agentPrompt,
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
  const sorted = [...flags].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity)
  )

  for (const flag of sorted) {
    const prompt = resolveFixPrompt(flag)
    if (prompt) {
      return { prompt, flag: flag.problem }
    }
  }
  return null
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
    const severityDiff = severityRank(a.flag.severity) - severityRank(b.flag.severity)
    if (severityDiff !== 0) return severityDiff
    return gradeRank(a.rubricGrade ?? '') - gradeRank(b.rubricGrade ?? '')
  })

  return ranked.slice(0, limit)
}
