'use client'

import { useCallback } from 'react'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getKindLabel(kind: ReportWorkspaceHistoryPoint['kind']): string {
  switch (kind) {
    case 'product-review':
      return 'Product review'
    case 'update-review':
      return 'Update review'
    case 'watch':
      return 'Watch run'
  }
}

function getKindShortLabel(kind: ReportWorkspaceHistoryPoint['kind']): string {
  switch (kind) {
    case 'product-review':
      return 'Review'
    case 'update-review':
      return 'Update'
    case 'watch':
      return 'Watch'
  }
}

export function ScanTimeline({
  history,
  selectedIndex,
  onSelect,
  isLoading = false,
  className,
}: {
  history: ReportWorkspaceHistoryPoint[]
  selectedIndex?: number | null
  onSelect?: (index: number) => void
  isLoading?: boolean
  className?: string
}) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (!onSelect) return
      const maxIndex = history.length + (isLoading ? 1 : 0) - 1
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          onSelect(Math.min(index + 1, maxIndex))
          break
        case 'ArrowUp':
          e.preventDefault()
          onSelect(Math.max(index - 1, 0))
          break
        case 'Home':
          e.preventDefault()
          onSelect(0)
          break
        case 'End':
          e.preventDefault()
          onSelect(maxIndex)
          break
      }
    },
    [history.length, isLoading, onSelect],
  )

  if (history.length === 0 && !isLoading) {
    return null
  }

  const activeIndex = selectedIndex ?? (history.length > 0 ? history.length - 1 : null)

  return (
    <div
      className={cn('flex flex-col gap-0', className)}
      role="listbox"
      aria-label="Scan history"
    >
      {history.map((point, index) => {
        const isActive = activeIndex === index
        const score = point.score
        const dotColor = score != null ? scoreToScanColor(score) : 'hsl(var(--muted-foreground))'

        return (
          <button
            key={point.id}
            type="button"
            role="option"
            aria-selected={isActive}
            aria-label={`${getKindLabel(point.kind)}, ${formatDate(point.checkedAt)}, score ${score != null ? Math.round(score) : 'unavailable'}`}
            onClick={() => onSelect?.(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={onSelect ? 0 : -1}
            className={cn(
              'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
              onSelect && 'cursor-pointer hover:bg-muted/60',
              !onSelect && 'cursor-default',
              isActive && 'bg-muted/80',
            )}
          >
            <span
              aria-hidden="true"
              className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full transition-transform',
                  isActive && 'scale-125',
                )}
                style={{ backgroundColor: dotColor }}
              />
              {isActive && (
                <span
                  className="absolute h-3.5 w-3.5 rounded-full border border-current opacity-30"
                  style={{ borderColor: dotColor }}
                />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-foreground tabular-nums">
                  {score != null ? Math.round(score) : '—'}
                </span>
                <span className="truncate text-2xs text-muted-foreground">
                  {getKindShortLabel(point.kind)}
                </span>
              </div>
              <div className="text-2xs text-muted-foreground/70">
                {formatDate(point.checkedAt)} · {formatTime(point.checkedAt)}
              </div>
            </div>
          </button>
        )
      })}

      {isLoading && (
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full bg-foreground/20 motion-safe:animate-pulse"
          />
          <span className="text-2xs text-muted-foreground">Scanning…</span>
        </div>
      )}
    </div>
  )
}
