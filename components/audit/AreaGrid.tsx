'use client'

import { GradeBadge } from '@/components/audit/GradeBadge'
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

export function AreaGrid({ areas, activeArea, onAreaClick, showScoreTypes }: Props) {
  const ordered = AREA_ORDER
    .map((n) => areas.find((a) => a.name === n))
    .filter(Boolean) as Area[]

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
        <div className="flex gap-4 mb-3 text-[10px] text-muted-foreground px-1">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand/30" /> Objective checks (0–100)</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500/30" /> Experience checks (A–F)</span>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-thin">
        {ordered.map((area) => {
          const issueCount = area.findings?.length ?? 0
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
                'flex min-h-11 min-w-[80px] shrink-0 flex-col items-center rounded-lg border px-3 py-2 transition-[box-shadow,transform] duration-200 hover:shadow-card motion-reduce:transition-none',
                area.grade ? 'border-border' : 'text-muted-foreground border-border',
                activeArea === area.name && 'ring-2 ring-brand ring-offset-2 ring-offset-background'
              )}
            >
              <GradeBadge grade={area.grade} score={area.score} size="sm" areaName={area.name} />
              <span className="mt-1 text-[9px] text-center leading-tight font-medium max-w-[72px] text-muted-foreground">
                {areaLabel(area.name)}
              </span>
              {issueCount > 0 && (
                <span className="mt-0.5 text-[9px] tabular-nums text-muted-foreground">
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
