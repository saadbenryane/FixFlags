'use client'

import { ScoreCard } from '@/components/audit/ScoreCard'
import { AREA_ORDER } from '@/lib/audit/constants'
import { cn, areaLabel } from '@/lib/utils'

interface Area {
  name: string
  grade: string | null
  score: number | null
  status: string | null
  findings?: Array<{ id: string }>
}

interface Props {
  areas: Area[]
  activeArea?: string | null
  onAreaClick?: (name: string) => void
  showScoreTypes?: boolean
}

const OBJECTIVE_AREAS = new Set(['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'MOBILE'])

export function AreaGrid({ areas, activeArea, onAreaClick, showScoreTypes }: Props) {
  const ordered = AREA_ORDER.map((n) => areas.find((a) => a.name === n)).filter(Boolean) as Area[]

  function handleClick(name: string) {
    if (onAreaClick) {
      onAreaClick(name)
      return
    }
    const el = document.getElementById(`area-${name}`)
    window.history.replaceState(null, '', `#area-${name}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav aria-label="Audit areas" className="-mx-1">
      {showScoreTypes && (
        <div className="mb-3 flex gap-4 px-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-brand/30" /> Objective checks (0–100)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" /> Experience checks (A–F)
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {ordered.map((area) => {
          const issueCount = area.findings?.length ?? 0
          const isObjective = OBJECTIVE_AREAS.has(area.name)

          return (
            <button
              key={area.name}
              type="button"
              title={
                issueCount > 0
                  ? `${issueCount} issue${issueCount === 1 ? '' : 's'}`
                  : areaLabel(area.name)
              }
              onClick={() => handleClick(area.name)}
              className={cn(
                'min-h-[5.5rem] text-left transition-[box-shadow,background-color] duration-200 ease-out motion-reduce:transition-none',
                activeArea === area.name && 'ring-2 ring-focus-ring ring-offset-2 rounded-card'
              )}
            >
              <ScoreCard
                areaName={area.name}
                grade={area.grade}
                score={isObjective ? area.score : null}
                size="sm"
                className={cn(
                  'h-full w-full shadow-none hover:shadow-filterPill',
                  activeArea === area.name && 'shadow-filterPill'
                )}
              />
              {issueCount > 0 && (
                <span className="mt-1 block px-1 text-[9px] tabular-nums text-muted-foreground">
                  {issueCount} issue{issueCount === 1 ? '' : 's'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
