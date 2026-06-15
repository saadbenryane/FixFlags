'use client'

import { ScoreCard } from '@/components/audit/ScoreCard'
import { AREA_ORDER } from '@/lib/audit/constants'

interface Area {
  name: string
  grade: string | null
  score: number | null
  findings?: Array<{ id: string }>
}

interface Props {
  areas: Area[]
}

export function AreaSummaryGrid({ areas }: Props) {
  const ordered = AREA_ORDER.map((name) => areas.find((a) => a.name === name)).filter(Boolean) as Area[]

  function scrollToArea(name: string) {
    const el = document.getElementById(`area-${name}`)
    window.history.replaceState(null, '', `#area-${name}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ordered.map((area) => {
        const issueCount = area.findings?.length ?? 0

        return (
          <div key={area.name} className="relative">
            <ScoreCard
              areaName={area.name}
              grade={area.grade}
              score={area.score}
              size="sm"
            />
            <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>
                {issueCount} issue{issueCount !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => scrollToArea(area.name)}
                className="text-xs font-medium text-link transition-colors duration-200 hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
              >
                View
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
