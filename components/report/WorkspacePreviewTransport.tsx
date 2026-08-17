'use client'

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
  /** Path to return to after signing in. Offered only to gated viewers. */
  signInNext?: string
  scanning?: boolean
  /** Curated emulations state their own capture status instead of an entitlement one. */
  statusLabel?: string
  className?: string
}

/** Fixed height in every state, so the stage above can never be resized by it. */
const TRANSPORT_HEIGHT_CLASS = 'h-14'

/**
 * Docked path transport under the Product stage. Device switching lives in the
 * Product header next to Preview; this bar owns scrub, step chips, and status.
 */
export function WorkspacePreviewTransport({
  steps = [],
  activeIndex = null,
  onSelectStep,
  onScrub,
  onBackToLive,
  canReplay = false,
  signInNext,
  scanning = false,
  statusLabel,
  className,
}: WorkspacePreviewTransportProps) {
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

  const status = resolveStatus()

  return (
    <div
      aria-label={REPORT_COPY.workspace.playback.transportLabel}
      className={cn(
        TRANSPORT_HEIGHT_CLASS,
        'flex shrink-0 items-center gap-3 border-t border-border/40 bg-background/70 px-3 sm:px-4',
        className
      )}
    >
      {replayable ? (
        <>
          <input
            type="range"
            min={0}
            max={steps.length - 1}
            step={1}
            value={selected >= 0 ? selected : 0}
            onChange={(event) => onScrub?.(Number(event.target.value))}
            aria-label={REPORT_COPY.workspace.playback.scrubLabel}
            className="min-w-0 flex-1 accent-brand"
          />
          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
            {REPORT_COPY.workspace.playback.counter(
              selected >= 0 ? selected + 1 : 0,
              steps.length
            )}
          </span>
          <ol
            aria-label={REPORT_COPY.workspace.playback.label}
            className="hidden max-w-[22rem] shrink items-center gap-1 overflow-x-auto [scrollbar-width:none] xl:flex [&::-webkit-scrollbar]:hidden"
          >
            {steps.map((step, index) => (
              <li key={step.id} className="shrink-0 list-none">
                <button
                  type="button"
                  aria-pressed={index === selected}
                  onClick={() => onSelectStep?.(index)}
                  className={cn(
                    'rounded-[var(--radius-control)] px-2 py-1 text-2xs font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                    index === selected
                      ? 'bg-[hsl(var(--brand-strong))] text-brand-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {REPORT_COPY.workspace.playback.stepNumber(index + 1)} · {step.label}
                </button>
              </li>
            ))}
          </ol>
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
        {!canReplay && signInNext ? (
          <Link
            href={{ pathname: '/sign-in', query: { next: signInNext } }}
            className="text-2xs font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {REPORT_COPY.workspace.timelineGate.action}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
