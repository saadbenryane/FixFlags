import { AlertTriangle, RotateCcw, ScanSearch } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { Skeleton } from '@/components/ui/skeleton'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { rubricLabel } from '@/lib/utils'
import type { RecheckDiffSummary } from '@/components/audit/RecheckDiffStrip'

export function ReportWorkspaceSummary({
  score,
  highImpactCount,
  rubricScores,
  recheckDiff,
  loading = false,
  progress,
}: {
  score: number | null
  highImpactCount: number
  rubricScores: Array<{ name: string; score: number | null }>
  recheckDiff?: RecheckDiffSummary | null
  loading?: boolean
  progress?: number
}) {
  const fixedCount = recheckDiff?.fixed.length ?? 0
  const newCount =
    (recheckDiff?.newIssues.length ?? 0) + (recheckDiff?.regressed.length ?? 0)

  return (
    <section aria-label="Report overview" className="grid gap-3 md:grid-cols-3">
      <Card className="flex min-h-32 items-center gap-4 p-4 sm:p-5">
        <ScoreRingGauge score={score} size="sm" loading={loading && score == null} progress={progress} />
        <div>
          <p className="text-xs font-medium text-muted-foreground">Readiness score</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {loading && score == null ? 'Calculating' : score == null ? 'Unavailable' : 'Out of 100'}
          </p>
        </div>
      </Card>

      <Card className="flex min-h-32 flex-col justify-between p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">High-impact Flags</p>
          <AlertTriangle className="h-4 w-4 text-brand" aria-hidden />
        </div>
        {loading && highImpactCount === 0 ? (
          <Skeleton className="h-9 w-14" />
        ) : (
          <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
            {highImpactCount}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {loading ? 'Verified findings appear here' : highImpactCount === 0 ? 'No critical or important Flags' : 'Fix these first'}
        </p>
      </Card>

      <Card className="flex min-h-32 flex-col justify-between p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            {recheckDiff ? 'Re-check result' : 'Coverage'}
          </p>
          {recheckDiff ? (
            <RotateCcw className="h-4 w-4 text-brand" aria-hidden />
          ) : (
            <ScanSearch className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </div>
        {recheckDiff ? (
          <>
            <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {fixedCount}
            </p>
            <p className="text-xs text-muted-foreground">
              cleared{newCount > 0 ? ` · ${newCount} new or regressed` : ''}
            </p>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            {RUBRIC_ORDER.map((name) => {
              const rubric = rubricScores.find((item) => item.name === name)
              return (
                <span key={name} className="rounded-full bg-muted/65 px-2.5 py-1 text-xs text-muted-foreground">
                  {rubricLabel(name)}
                  {rubric?.score != null ? ` ${rubric.score}` : ''}
                </span>
              )
            })}
          </div>
        )}
      </Card>
    </section>
  )
}
