'use client'

import { cn, gradeColor, areaLabel } from '@/lib/utils'

interface Area {
  name: string
  grade: string
  score: number | null
  status: string
}

interface Props {
  areas: Area[]
  activeArea?: string | null
  onAreaClick?: (name: string) => void
}

export function AreaGrid({ areas, activeArea, onAreaClick }: Props) {
  const orderedNames = [
    'PERFORMANCE',
    'ACCESSIBILITY',
    'SEO',
    'CONVERSION',
    'TRUST',
    'CONTENT',
    'MOBILE',
  ]
  const ordered = orderedNames
    .map((n) => areas.find((a) => a.name === n))
    .filter(Boolean) as Area[]

  function handleClick(name: string) {
    if (onAreaClick) {
      onAreaClick(name)
      return
    }
    const el = document.getElementById(`area-${name}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav aria-label="Audit areas" className="-mx-1">
      <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-thin">
        {ordered.map((area) => {
          const hasIssues = area.grade !== 'A'
          return (
            <button
              key={area.name}
              type="button"
              onClick={() => handleClick(area.name)}
              className={cn(
                'flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 min-w-[72px] transition-all hover:shadow-card',
                gradeColor(area.grade),
                activeArea === area.name && 'ring-2 ring-brand ring-offset-2 ring-offset-background'
              )}
            >
              <span className="text-lg font-bold leading-none">{area.grade}</span>
              {area.score !== null && (
                <span className="text-[10px] font-medium tabular-nums mt-0.5">{area.score}</span>
              )}
              <span className="mt-1 text-[9px] text-center leading-tight font-medium max-w-[64px]">
                {areaLabel(area.name)}
              </span>
              {hasIssues && (
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
