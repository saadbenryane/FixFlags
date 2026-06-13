import { cn, gradeColor, areaLabel } from '@/lib/utils'

interface AreaData {
  name: string
  grade: string
  score: number | null
}

interface AreaRow {
  name: string
  before: AreaData
  after: AreaData
  scoreDelta: number | null
  gradeImproved: boolean
  gradeRegressed: boolean
  gradeUnchanged: boolean
}

interface Props {
  beforeAreas: AreaData[]
  afterAreas: AreaData[]
}

const AREA_ORDER = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE']

const gradeValue: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 }

export function AreaDiff({ beforeAreas, afterAreas }: Props) {
  const rows: AreaRow[] = []
  for (const name of AREA_ORDER) {
    const before = beforeAreas.find((a) => a.name === name)
    const after = afterAreas.find((a) => a.name === name)
    if (!before || !after) continue
    rows.push({
      name,
      before,
      after,
      scoreDelta: after.score !== null && before.score !== null ? after.score - before.score : null,
      gradeImproved: gradeValue[after.grade] > gradeValue[before.grade],
      gradeRegressed: gradeValue[after.grade] < gradeValue[before.grade],
      gradeUnchanged: after.grade === before.grade,
    })
  }

  const improved = rows.filter((r) => r.gradeImproved).length
  const regressed = rows.filter((r) => r.gradeRegressed).length
  const unchanged = rows.filter((r) => r.gradeUnchanged).length

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        {improved > 0 && <span className="text-green-600 font-medium">{improved} improved</span>}
        {unchanged > 0 && <span className="text-muted-foreground">{unchanged} unchanged</span>}
        {regressed > 0 && <span className="text-destructive font-medium">{regressed} regressed</span>}
      </div>

      <div className="rounded-xl border overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.name}
            className={cn('flex items-center gap-4 px-4 py-3', i > 0 && 'border-t')}
          >
            <div className="w-28 text-sm font-medium">{areaLabel(row.name)}</div>

            {/* Before grade */}
            <div className={cn('text-sm font-bold px-2 py-0.5 rounded border', gradeColor(row.before.grade))}>
              {row.before.grade}
              {row.before.score !== null && <span className="ml-1 text-xs font-normal opacity-70">{row.before.score}</span>}
            </div>

            {/* Arrow */}
            <div className={cn('text-sm font-medium', row.gradeImproved ? 'text-green-600' : row.gradeRegressed ? 'text-destructive' : 'text-muted-foreground')}>
              {row.gradeImproved ? '→' : row.gradeRegressed ? '→' : '→'}
            </div>

            {/* After grade */}
            <div className={cn('text-sm font-bold px-2 py-0.5 rounded border', gradeColor(row.after.grade))}>
              {row.after.grade}
              {row.after.score !== null && <span className="ml-1 text-xs font-normal opacity-70">{row.after.score}</span>}
            </div>

            {/* Score delta */}
            {row.scoreDelta !== null && (
              <div className={cn('ml-auto text-sm font-medium', row.scoreDelta > 0 ? 'text-green-600' : row.scoreDelta < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                {row.scoreDelta > 0 ? '+' : ''}{row.scoreDelta}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
