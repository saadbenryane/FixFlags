'use client'

import { cn } from '@/lib/utils'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import type { ScanCheck } from '@/lib/marketing/sample-report-display'

function ScanBar({
  score,
  active,
}: {
  score: number
  active?: boolean
}) {
  const height = 10 + Math.round((score / 100) * 10)
  const color = scoreToScanColor(score)

  return (
    <span
      aria-hidden
      className={cn(
        'inline-block shrink-0 rounded-full motion-safe:transition-all motion-safe:duration-200',
        active && 'ring-2 ring-brand/50 ring-offset-1'
      )}
      style={{
        width: 4,
        height,
        backgroundColor: color,
        opacity: active ? 1 : 0.88,
      }}
    />
  )
}

interface ScanTimelineProps {
  scans: ScanCheck[]
  activeFlagIndex: number
  onSelectFlag?: (flagIndex: number) => void
  className?: string
  compact?: boolean
}

/** Row of colored scan bars — uniform style, color = score. Failed checks are gaps. */
export function ScanTimeline({
  scans,
  activeFlagIndex,
  onSelectFlag,
  className,
  compact = false,
}: ScanTimelineProps) {
  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'flex items-end gap-1 overflow-x-auto pb-0.5',
          compact ? 'max-h-[20px]' : 'max-h-[24px]'
        )}
        role="list"
        aria-label="Scan results"
      >
        {scans.map((scan) => {
          if (scan.score == null) {
            return <span key={scan.id} className="inline-block w-1 shrink-0" aria-hidden />
          }

          const isActive = scan.flagIndex != null && scan.flagIndex === activeFlagIndex
          const bar = <ScanBar score={scan.score} active={isActive} />

          if (scan.flagIndex != null && onSelectFlag) {
            return (
              <button
                key={scan.id}
                type="button"
                role="listitem"
                onClick={() => onSelectFlag(scan.flagIndex!)}
                className={cn(
                  'flex shrink-0 items-end rounded-sm px-px py-0.5 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  isActive ? 'opacity-100' : 'opacity-75'
                )}
                aria-label={`Check: ${scan.label}, score ${scan.score}`}
                aria-current={isActive ? 'step' : undefined}
              >
                {bar}
              </button>
            )
          }

          return (
            <div
              key={scan.id}
              role="listitem"
              className="flex shrink-0 items-end px-px"
              aria-label={`${scan.label}, score ${scan.score}`}
            >
              {bar}
            </div>
          )
        })}
      </div>
      {!compact && (
        <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-wide text-muted-foreground/50">
          24 checks · bar color = score
        </p>
      )}
    </div>
  )
}
