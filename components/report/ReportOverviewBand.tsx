import { Flag, Gauge } from 'lucide-react'
import { RubricBar } from '@/components/audit/RubricBar'
import type { RubricComputed } from '@/lib/audit/rubric'
import { cn } from '@/lib/utils'
import { REPORT_COPY } from '@/lib/marketing/copy'

interface RubricRow {
  name: string
  score: number | null
  grade: string | null
}

export function ReportOverviewBand({
  unresolvedCount,
  score,
  rubrics,
  rubricRows,
  loading = false,
  className,
}: {
  unresolvedCount: number
  score: number | null
  rubrics: RubricComputed[]
  rubricRows: RubricRow[]
  loading?: boolean
  className?: string
}) {
  return (
    <section
      aria-label={REPORT_COPY.reportFirst.summaryLabel}
      className={cn(
        'grid gap-3 rounded-card border border-border/50 bg-card/70 p-3 shadow-card sm:grid-cols-[auto_auto_1fr] sm:items-center sm:gap-4 sm:px-4',
        className
      )}
    >
      <div className="flex min-h-11 items-center gap-2 border-b border-border/40 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
        <Flag className="h-4 w-4 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
            {REPORT_COPY.reportFirst.unresolvedLabel}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {loading && unresolvedCount === 0
              ? REPORT_COPY.reportFirst.checkingLabel
              : unresolvedCount}
          </p>
        </div>
      </div>
      <div className="flex min-h-11 items-center gap-2 border-b border-border/40 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
        <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
            {REPORT_COPY.reportFirst.readinessLabel}
          </p>
          <p
            className="font-mono text-sm font-semibold tabular-nums"
            aria-label={
              score == null
                ? loading
                  ? REPORT_COPY.reportFirst.statusPendingLabel
                  : REPORT_COPY.reportFirst.overallUnavailableLabel
                : `Overall status: ${score} out of 100`
            }
          >
            {score == null
              ? loading
                ? REPORT_COPY.reportFirst.calculatingLabel
                : REPORT_COPY.reportFirst.unavailableLabel
              : `${score}/100`}
          </p>
        </div>
      </div>
      <RubricBar rubrics={rubrics} rubricRows={rubricRows} loading={loading} />
    </section>
  )
}
