import { FindingCard } from '@/components/audit/FindingCard'
import { gradeRank, severityRank } from '@/lib/utils'

interface Finding {
  id: string
  severity: string
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
}

interface Area {
  name: string
  grade: string
  findings: Finding[]
}

interface Props {
  areas: Area[]
  limit?: number
  showFeedback?: boolean
}

export function PriorityFindings({ areas, limit = 8, showFeedback = true }: Props) {
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
    return gradeRank(a.areaGrade) - gradeRank(b.areaGrade)
  })

  const top = ranked.slice(0, limit)

  if (top.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-heading">Priority fixes</h2>
        <span className="text-xs text-muted-foreground">
          Top {top.length} issue{top.length !== 1 ? 's' : ''} across all areas
        </span>
      </div>
      <div className="rounded-card bg-card shadow-card overflow-hidden">
        {top.map(({ finding, areaName }) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            areaName={areaName}
            showFeedback={showFeedback}
            variant="row"
          />
        ))}
      </div>
    </section>
  )
}
