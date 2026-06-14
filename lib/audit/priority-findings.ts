import { gradeRank, severityRank } from '@/lib/utils'

export interface RankableFinding {
  id: string
  severity: string
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
}

export interface RankableArea {
  name: string
  grade: string | null
  findings: RankableFinding[]
}

export function rankFindingsByPriority(
  areas: RankableArea[],
  limit = 3
): Array<{ finding: RankableFinding; areaName: string; areaGrade: string | null }> {
  const ranked = areas.flatMap((area) =>
    area.findings.map((finding) => ({
      finding,
      areaName: area.name,
      areaGrade: area.grade,
    }))
  )

  ranked.sort((a, b) => {
    const severityDiff = severityRank(a.finding.severity) - severityRank(b.finding.severity)
    if (severityDiff !== 0) return severityDiff
    return gradeRank(a.areaGrade ?? '') - gradeRank(b.areaGrade ?? '')
  })

  return ranked.slice(0, limit)
}

export function getTopFixPromptFromAreas(
  areas: RankableArea[]
): { prompt: string; finding?: string } | null {
  const ranked = rankFindingsByPriority(areas, 20)
  for (const { finding } of ranked) {
    const prompt = finding.cursorPrompt ?? finding.agentPrompt ?? finding.fix
    if (prompt) {
      return { prompt, finding: finding.problem }
    }
  }
  return null
}
