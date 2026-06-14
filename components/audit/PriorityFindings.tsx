'use client'

import { FindingCard } from '@/components/audit/FindingCard'
import { rankFindingsByPriority, type RankableArea } from '@/lib/audit/priority-findings'

interface Props {
  areas: RankableArea[]
  limit?: number
  showFeedback?: boolean
  defaultCollapsed?: boolean
}

export function PriorityFindings({
  areas,
  limit = 3,
  showFeedback = true,
  defaultCollapsed = true,
}: Props) {
  const top = rankFindingsByPriority(areas, limit)

  if (top.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-heading">Priority fixes</h2>
        <span className="text-xs text-muted-foreground">
          Top {top.length} issue{top.length !== 1 ? 's' : ''} — expand for evidence
        </span>
      </div>
      <div className="overflow-hidden rounded-card border-0 bg-card shadow-card">
        {top.map(({ finding, areaName }) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            areaName={areaName}
            showFeedback={showFeedback}
            variant="row"
            defaultExpanded={!defaultCollapsed}
          />
        ))}
      </div>
    </section>
  )
}
