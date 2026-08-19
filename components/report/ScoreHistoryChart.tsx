'use client'

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'

const BAR_WIDTH = 3
const MIN_TAP_TARGET = 20

function scoreToColor(score: number | null): string {
  if (score === null) return 'hsl(var(--muted))'
  if (score >= 80) return 'hsl(142 71% 45%)'
  if (score >= 60) return 'hsl(48 96% 53%)'
  return 'hsl(0 84% 60%)'
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
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

function getStatusLabel(status: ReportWorkspaceHistoryPoint['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'partial':
      return 'Partial capture'
    case 'degraded':
      return 'Degraded capture'
    case 'failed':
      return 'Failed capture'
  }
}

export function ScoreHistoryChart({
  history,
  className,
  onSelect,
  selectedIndex,
  isLoading = false,
}: {
  history: ReportWorkspaceHistoryPoint[]
  className?: string
  onSelect?: (index: number) => void
  selectedIndex?: number | null
  isLoading?: boolean
}) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (!onSelect) return
      const maxIndex = history.length + (isLoading ? 1 : 0) - 1
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          onSelect(Math.min(index + 1, maxIndex))
          break
        case 'ArrowLeft':
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
    return (
      <div
        className={cn('py-2 text-center text-muted-foreground', className)}
        role="status"
        aria-label="No score history available"
      >
        No observations yet
      </div>
    )
  }

  return (
    <div
      className={cn('flex items-end gap-px', className)}
      role="toolbar"
      aria-label="Score history observations"
      tabIndex={0}
    >
      {history.map((point, index) => {
        const isActive = selectedIndex === index
        const score = point.score

        const ariaLabel = score !== null
          ? `${getKindLabel(point.kind)}, ${formatDateLabel(point.checkedAt)}, score ${Math.round(score)}`
          : `${getKindLabel(point.kind)}, ${formatDateLabel(point.checkedAt)}, ${getStatusLabel(point.status)}`

        return (
          <button
            key={point.id}
            type="button"
            aria-label={ariaLabel}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect?.(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={onSelect ? 0 : -1}
            className="relative flex items-end border-0 bg-transparent p-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
            style={{ minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET }}
          >
            <span
              aria-hidden="true"
              className={cn(
                'rounded-sm transition-all duration-150',
                isActive && 'ring-1 ring-foreground/40',
              )}
              style={{
                width: BAR_WIDTH,
                height: score !== null ? Math.max(4, (score / 100) * 32) : 4,
                backgroundColor: scoreToColor(score),
                opacity: score !== null ? (isActive ? 1 : 0.7) : 0.3,
              }}
            />
          </button>
        )
      })}
      {isLoading && (
        <span
          role="img"
          aria-label="Live scan in progress"
          className="inline-block rounded-sm bg-foreground/20"
          style={{ width: BAR_WIDTH, height: 16 }}
        />
      )}

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {selectedIndex != null && selectedIndex < history.length ? (
          <>
            Selected: {history[selectedIndex]?.score !== null
              ? `${getKindLabel(history[selectedIndex].kind)}, score ${Math.round(history[selectedIndex].score!)}`
              : `${getKindLabel(history[selectedIndex].kind)}, ${getStatusLabel(history[selectedIndex].status)}`}
          </>
        ) : null}
      </span>
    </div>
  )
}
