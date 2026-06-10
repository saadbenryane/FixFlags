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
  const orderedNames = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE']
  const ordered = orderedNames.map((n) => areas.find((a) => a.name === n)).filter(Boolean) as Area[]

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {ordered.map((area) => (
        <button
          key={area.name}
          onClick={() => onAreaClick?.(area.name)}
          className={cn(
            'flex flex-col items-center rounded-lg border-2 px-2 py-3 transition-all hover:shadow-sm',
            gradeColor(area.grade),
            activeArea === area.name ? 'ring-2 ring-primary ring-offset-1' : ''
          )}
        >
          <span className="text-xl font-bold">{area.grade}</span>
          {area.score !== null && (
            <span className="text-xs font-medium">{area.score}</span>
          )}
          <span className="mt-1 text-[10px] text-center leading-tight font-medium">
            {areaLabel(area.name)}
          </span>
        </button>
      ))}
    </div>
  )
}
