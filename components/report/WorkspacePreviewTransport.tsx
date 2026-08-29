'use client'

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import type { PlaybackStep } from '@/lib/audit/playback-steps'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface WorkspacePreviewTransportProps {
  steps?: PlaybackStep[]
  activeIndex?: number | null
  onSelectStep?: (index: number) => void
  onScrub?: (index: number) => void
  onBackToLive?: () => void
  /** Timeline payload is owner-only. Gated viewers get status, never steps. */
  canReplay?: boolean
  /** Optional claim action. Non-owner/share viewers remain honestly read-only. */
  gateActionHref?: string
  scanning?: boolean
  /** Curated emulations state their own capture status instead of an entitlement one. */
  statusLabel?: string
  className?: string
}

/** Fixed height in every state, so the stage above can never be resized by it. */
const TRANSPORT_HEIGHT_CLASS = 'h-12'

/**
 * PARKED: not mounted on the live Agent|Report shell (`/report/[id]`).
 * Keep for a future Preview unpark. Do not rewire into ReportWorkspaceSplitShell
 * without an explicit product decision.
 *
 * Docked timeline transport under the Product stage.
 * A horizontal line with dot markers at each step position, like a video
 * timeline. Scrubbing happens by clicking dots or dragging along the track.
 */
export function WorkspacePreviewTransport({
  steps = [],
  activeIndex = null,
  onSelectStep,
  onScrub,
  onBackToLive,
  canReplay = false,
  gateActionHref,
  scanning = false,
  statusLabel,
  className,
}: WorkspacePreviewTransportProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const replayable = canReplay && steps.length > 0
  const selected =
    replayable && activeIndex != null && activeIndex >= 0 && activeIndex < steps.length
      ? activeIndex
      : -1
  const activeStep = selected >= 0 ? steps[selected] : undefined

  function resolveStatus(): string {
    if (activeStep) {
      return `${REPORT_COPY.workspace.playback.stepNumber(selected + 1)} · ${activeStep.label}`
    }
    if (statusLabel) return statusLabel
    if (scanning) return REPORT_COPY.workspace.playback.capturing
    if (replayable) return REPORT_COPY.workspace.playback.liveCapture
    if (canReplay) return REPORT_COPY.workspace.playback.noSteps
    return REPORT_COPY.workspace.timelineGate.title
  }

  const resolveIndexFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || steps.length === 0) return -1
      const rect = track.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return Math.round(ratio * (steps.length - 1))
    },
    [steps.length],
  )

  const handleTrackPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!replayable) return
      const index = resolveIndexFromPointer(event.clientX)
      if (index >= 0) onScrub?.(index)
    },
    [replayable, resolveIndexFromPointer, onScrub],
  )

  const status = resolveStatus()

  return (
    <div
      role="group"
      aria-label={REPORT_COPY.workspace.playback.transportLabel}
      className={cn(
        TRANSPORT_HEIGHT_CLASS,
        'flex shrink-0 items-center gap-3 border-t border-border/40 bg-background/70 px-3 sm:px-4',
        className,
      )}
    >
      {replayable ? (
        <>
          {/* Timeline track */}
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label={REPORT_COPY.workspace.playback.scrubLabel}
            aria-valuemin={0}
            aria-valuemax={steps.length - 1}
            aria-valuenow={selected >= 0 ? selected : 0}
            aria-valuetext={activeStep ? activeStep.label : REPORT_COPY.workspace.playback.liveCapture}
            className="group relative flex min-h-8 min-w-0 flex-1 cursor-pointer touch-none select-none items-center"
            onPointerDown={handleTrackPointerDown}
            onKeyDown={(event) => {
              if (!replayable) return
              if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                event.preventDefault()
                const next = Math.min(selected + 1, steps.length - 1)
                onScrub?.(next)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                event.preventDefault()
                const prev = Math.max(selected - 1, 0)
                onScrub?.(prev)
              }
            }}
          >
            {/* Track line */}
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
            {/* Progress fill */}
            <div
              className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-foreground/50 transition-[width] duration-150"
              style={{ width: `${steps.length > 1 ? (selected / (steps.length - 1)) * 100 : 0}%` }}
            />
            {/* Step dots */}
            {steps.map((step, index) => {
              const pct = steps.length > 1 ? (index / (steps.length - 1)) * 100 : 0
              const isActive = index === selected
              const isPast = selected >= 0 && index < selected
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`${REPORT_COPY.workspace.playback.stepNumber(index + 1)} · ${step.label}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectStep?.(index)
                  }}
                  className={cn(
                    'absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height,background-color,box-shadow] duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
                    isActive
                      ? 'h-3 w-3 bg-foreground shadow-[0_0_0_2px] shadow-background'
                      : isPast
                        ? 'h-2 w-2 bg-foreground/60 hover:h-2.5 hover:w-2.5'
                        : 'h-2 w-2 bg-muted-foreground/40 hover:h-2.5 hover:w-2.5 hover:bg-muted-foreground/60',
                  )}
                  style={{ left: `${pct}%` }}
                />
              )
            })}
          </div>

          {/* Counter */}
          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
            {REPORT_COPY.workspace.playback.counter(
              selected >= 0 ? selected + 1 : 0,
              steps.length,
            )}
          </span>
        </>
      ) : (
        <div className="min-w-0 flex-1" />
      )}

      <div className="flex shrink-0 items-center gap-2">
        {scanning ? (
          <span
            className="h-1.5 w-1.5 rounded-full bg-brand motion-safe:animate-pulse"
            aria-hidden
          />
        ) : null}
        <p className="hidden max-w-[16rem] truncate text-2xs text-muted-foreground sm:block">
          {status}
        </p>
        {activeStep && onBackToLive ? (
          <button
            type="button"
            onClick={onBackToLive}
            className="rounded-[var(--radius-control)] px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {REPORT_COPY.workspace.playback.backToLive}
          </button>
        ) : null}
        {!canReplay && gateActionHref ? (
          <Link
            href={gateActionHref as Route}
            className="text-2xs font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {REPORT_COPY.workspace.timelineGate.action}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
