'use client'

import { useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'

const BAR_WIDTH = 16
const BAR_GAP = 12
const BAR_HEIGHT = 64
const CHIP_HEIGHT = 20
const CARET_SIZE = 8
const MIN_TAP_TARGET = 44
const GREEN_100 = '#22C55E'

function getScoreOpacity(score: number | null): number {
  if (score === null) return 0
  if (score >= 99) return 1
  return Math.max(0.15, score / 100)
}

function getBarColor(score: number | null): string {
  if (score === null) return 'hsl(var(--border))'
  if (score >= 100) return GREEN_100
  return 'hsl(var(--foreground))'
}

function getBarOpacity(score: number | null, isActive: boolean): number {
  if (score === null) return 0
  if (score >= 100) return 1
  const baseOpacity = getScoreOpacity(score)
  return isActive ? 1 : baseOpacity
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatScoreChip(score: number): string {
  return `${Math.round(score)}`
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
  const containerRef = useRef<HTMLDivElement>(null)

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
    [history.length, isLoading, onSelect]
  )

  if (history.length === 0 && !isLoading) {
    return (
      <div
        className={cn('w-full py-8 text-center text-muted-foreground', className)}
        role="status"
        aria-label="No score history available"
      >
        No observations yet
      </div>
    )
  }

  const firstDate = history[0]?.checkedAt
  const lastDate = history[history.length - 1]?.checkedAt

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full', className)}
      role="region"
      aria-label="Product score history"
    >
      <style>{`
        .spineContainer {
          display: flex;
          align-items: flex-end;
          gap: ${BAR_GAP}px;
          padding: 0 ${BAR_GAP}px ${CHIP_HEIGHT + CARET_SIZE + 32}px;
          min-height: ${BAR_HEIGHT + CHIP_HEIGHT + CARET_SIZE + 40}px;
          overflow-x: auto;
          scrollbar-width: thin;
          scrollbar-color: hsl(var(--border)) transparent;
        }
        .spineContainer::-webkit-scrollbar {
          height: 6px;
        }
        .spineContainer::-webkit-scrollbar-track {
          background: transparent;
        }
        .spineContainer::-webkit-scrollbar-thumb {
          background-color: hsl(var(--border));
          border-radius: 3px;
        }
        .barWrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: ${MIN_TAP_TARGET}px;
          position: relative;
        }
        .tapTarget {
          width: ${MIN_TAP_TARGET}px;
          height: ${MIN_TAP_TARGET}px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          position: relative;
          z-index: 1;
          background: none;
          border: 0;
          padding: 0;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .bar {
          width: ${BAR_WIDTH}px;
          height: ${BAR_HEIGHT}px;
          border-radius: 2px;
          transition: opacity 200ms ease-out, background-color 200ms ease-out,
            transform 150ms ease-out;
          position: relative;
        }
        .bar:hover {
          transform: scaleY(1.05);
        }
        .barActive {
          z-index: 2;
        }
        .barNoScore {
          background: transparent;
          border: 2px solid hsl(var(--border));
        }
        .barNoScore::after {
          content: '';
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: hsl(var(--border));
        }
        .scoreChip {
          position: absolute;
          bottom: calc(100% + ${CARET_SIZE + 4}px);
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          line-height: ${CHIP_HEIGHT}px;
          padding: 0 6px;
          border-radius: 4px;
          white-space: nowrap;
          color: hsl(var(--foreground));
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          box-shadow: 0 2px 8px hsl(var(--foreground) / 0.1);
          opacity: 0;
          pointer-events: none;
          transition: opacity 150ms ease-out;
          z-index: 3;
        }
        .barWrapper:hover .scoreChip,
        .barActive .scoreChip {
          opacity: 1;
        }
        .caret {
          position: absolute;
          bottom: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: ${CARET_SIZE}px;
          height: ${CARET_SIZE}px;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-right: none;
          border-bottom: none;
          opacity: 0;
          pointer-events: none;
          transition: opacity 150ms ease-out;
          z-index: 2;
        }
        .barWrapper:hover .caret,
        .barActive .caret {
          opacity: 1;
        }
        .dateLabel {
          position: absolute;
          bottom: calc(100% + ${CHIP_HEIGHT + CARET_SIZE + 12}px);
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          color: hsl(var(--muted-foreground));
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 150ms ease-out;
        }
        .barWrapper:hover .dateLabel,
        .barActive .dateLabel {
          opacity: 1;
        }
        .firstDate, .lastDate {
          position: absolute;
          bottom: calc(100% + ${CHIP_HEIGHT + CARET_SIZE + 28}px);
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          color: hsl(var(--muted-foreground));
          white-space: nowrap;
          opacity: 0.7;
        }
        .firstDate { left: ${BAR_GAP}px; }
        .lastDate { right: ${BAR_GAP}px; }
        .shimmerBar {
          background: linear-gradient(
            90deg,
            hsl(var(--muted)) 25%,
            hsl(var(--muted) / 0.5) 50%,
            hsl(var(--muted)) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite linear;
        }
        .indeterminateBar {
          background: linear-gradient(
            90deg,
            hsl(var(--brand) / 0.2) 25%,
            hsl(var(--brand) / 0.6) 50%,
            hsl(var(--brand) / 0.2) 75%
          );
          background-size: 200% 100%;
          animation: indeterminate 1.2s infinite linear;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes indeterminate {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .shimmerBar, .indeterminateBar {
            animation: none;
            background: hsl(var(--muted));
          }
          .indeterminateBar {
            background: hsl(var(--brand) / 0.3);
          }
        }
        .srOnly {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>

      <div className="spineContainer" role="list" aria-label="Score history observations">
        {history.map((point, index) => {
          const isActive = selectedIndex === index
          const score = point.score
          const hasScore = score !== null
          const barColor = getBarColor(score)
          const barOpacity = getBarOpacity(score, isActive)
          const isNoScore = !hasScore

          const ariaLabel = hasScore
            ? `${getKindLabel(point.kind)}, ${formatDateLabel(point.checkedAt)}, score ${Math.round(score)}`
            : `${getKindLabel(point.kind)}, ${formatDateLabel(point.checkedAt)}, ${getStatusLabel(point.status)}`

          return (
            <div key={point.id} className="barWrapper" role="listitem">
              <button
                type="button"
                className="tapTarget"
                aria-label={ariaLabel}
                aria-roledescription="score bar"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelect?.(index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                tabIndex={onSelect ? 0 : -1}
              >
                <div
                  className={cn(
                    'bar',
                    isActive && 'barActive',
                    isNoScore && 'barNoScore'
                  )}
                  style={{
                    backgroundColor: isNoScore ? undefined : barColor,
                    opacity: isNoScore ? 1 : barOpacity,
                  }}
                  aria-hidden="true"
                />
              </button>
              {hasScore && (
                <>
                  <div className="caret" aria-hidden="true" />
                  <div className="scoreChip" aria-hidden="true">
                    {formatScoreChip(score)}
                  </div>
                </>
              )}
              <div className="dateLabel" aria-hidden="true">
                {formatDateLabel(point.checkedAt)}
              </div>
            </div>
          )
        })}
        {isLoading && (
          <div className="barWrapper" role="listitem">
            <div
              className="tapTarget"
              role="img"
              aria-label="Live scan in progress"
              aria-roledescription="score bar"
              aria-live="polite"
            >
              <div className="bar indeterminateBar" aria-hidden="true" />
            </div>
            <div className="caret" aria-hidden="true" />
            <div className="scoreChip" aria-hidden="true">
              …
            </div>
          </div>
        )}
        {(history.length > 1 && firstDate && lastDate) ? (
          <>
            <div className="firstDate" aria-hidden="true">
              {formatDateLabel(firstDate)}
            </div>
            <div className="lastDate" aria-hidden="true">
              {formatDateLabel(lastDate)}
            </div>
          </>
        ) : null}
      </div>

      <div className="srOnly" role="status" aria-live="polite" aria-atomic="true">
        {selectedIndex != null && selectedIndex < history.length ? (
          <>
            Selected: {history[selectedIndex]?.score !== null
              ? `${getKindLabel(history[selectedIndex].kind)}, score ${Math.round(history[selectedIndex].score!)}`
              : `${getKindLabel(history[selectedIndex].kind)}, ${getStatusLabel(history[selectedIndex].status)}`}
          </>
        ) : null}
      </div>
    </div>
  )
}