'use client'

import { cn } from '@/lib/utils'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import type { ScanCheck } from '@/lib/marketing/sample-report-display'

/** Orange flag pin — only for critical findings, not the logo mark. */
function CriticalFlagPin({ active }: { active?: boolean }) {
  return (
    <svg
      width={10}
      height={16}
      viewBox="0 0 10 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn(
        'shrink-0 motion-safe:transition-transform motion-safe:duration-200',
        active && 'scale-110'
      )}
    >
      <rect
        x="4"
        y="4"
        width="2"
        height="12"
        rx="1"
        fill={active ? 'hsl(var(--brand))' : 'hsl(var(--brand) / 0.85)'}
      />
      <path
        d="M4 4 L4 1 L9 4.5 L6.5 6.5 Z"
        fill={active ? 'hsl(var(--brand))' : 'hsl(var(--brand) / 0.85)'}
      />
    </svg>
  )
}

function ScanBar({
  score,
  active,
}: {
  score: number
  active?: boolean
}) {
  const height = 10 + Math.round((score / 100) * 8)
  const color = scoreToScanColor(score)

  return (
    <span
      aria-hidden
      className={cn(
        'inline-block shrink-0 rounded-full motion-safe:transition-all motion-safe:duration-200',
        active && 'ring-2 ring-brand/40 ring-offset-1'
      )}
      style={{
        width: 4,
        height,
        backgroundColor: color,
        opacity: active ? 1 : 0.9,
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
          compact ? 'max-h-[18px]' : 'max-h-[22px]'
        )}
        role="list"
        aria-label="Scan results"
      >
        {scans.map((scan) => {
          const isFailed = scan.score == null && !scan.isCritical
          const isActive = scan.flagIndex != null && scan.flagIndex === activeFlagIndex
          const showFlag = scan.isCritical === true

          if (isFailed) {
            return (
              <span
                key={scan.id}
                className="inline-block w-1 shrink-0"
                aria-hidden
              />
            )
          }

          const content = showFlag ? (
            <CriticalFlagPin active={isActive} />
          ) : scan.score != null ? (
            <ScanBar score={scan.score} active={isActive} />
          ) : null

          if (!content) return null

          if (scan.flagIndex != null && onSelectFlag) {
            return (
              <button
                key={scan.id}
                type="button"
                role="listitem"
                onClick={() => onSelectFlag(scan.flagIndex!)}
                className={cn(
                  'flex shrink-0 items-end rounded-sm px-px py-0.5 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  isActive ? 'opacity-100' : 'opacity-80'
                )}
                aria-label={
                  showFlag
                    ? `Critical flag ${scan.flagIndex + 1}: ${scan.label}`
                    : `Check: ${scan.label}, score ${scan.score}`
                }
                aria-current={isActive ? 'step' : undefined}
              >
                {content}
              </button>
            )
          }

          return (
            <div
              key={scan.id}
              role="listitem"
              className="flex shrink-0 items-end px-px"
              aria-label={`${scan.label}${scan.score != null ? `, score ${scan.score}` : ''}`}
            >
              {content}
            </div>
          )
        })}
      </div>
      {!compact && (
        <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wide text-muted-foreground/55">
          <span>0</span>
          <span className="text-center">24 checks · color = score</span>
          <span>100</span>
        </div>
      )}
    </div>
  )
}
