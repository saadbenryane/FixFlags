'use client'

import { Flag } from 'lucide-react'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

/**
 * Keyframes for the calm "scanning" working mark. Colocated via a <style> tag
 * like the skeleton shimmer so no global keyframes are needed. Call sites gate
 * the animations with motion-safe: so reduced-motion users get a static badge.
 */
export const SCAN_WORKING_KEYFRAMES = `@keyframes ff-scan-pulse {
  0% { transform: scale(0.62); opacity: 0.55; }
  75% { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1.5); opacity: 0; }
}
@keyframes ff-scan-spin {
  to { transform: rotate(360deg); }
}`

/** Animated brand mark that reads as "the agent is working" without blinking. */
export function ScanWorkingMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 ring-1 ring-brand/25',
        className
      )}
    >
      <style>{SCAN_WORKING_KEYFRAMES}</style>
      <span
        className="absolute inset-0 rounded-full opacity-30 motion-safe:animate-[ff-scan-spin_2.6s_linear_infinite]"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg 260deg, hsl(var(--brand)) 330deg, transparent 360deg)',
        }}
      />
      <Flag className="relative h-4 w-4 text-brand" strokeWidth={2} />
      <span className="pointer-events-none absolute inset-0 rounded-full border border-brand/45 motion-safe:animate-[ff-scan-pulse_2.4s_cubic-bezier(0,0,0.2,1)_infinite]" />
      <span
        className="pointer-events-none absolute inset-0 rounded-full border border-brand/35 motion-safe:animate-[ff-scan-pulse_2.4s_cubic-bezier(0,0,0.2,1)_infinite]"
        style={{ animationDelay: '1.2s' }}
      />
    </span>
  )
}

interface ScanWorkingStatusProps {
  /** Honest live stage detail, e.g. "Desktop and mobile views…". */
  stageDetail: string
  /** Progress percent 0-100 shown in mono next to the working label. */
  progress: number
  /** Current step ordinal (1-based). */
  current: number
  /** Total pipeline steps. */
  total: number
  className?: string
}

/**
 * "Working" status header for the Agent panel while a review runs. Mirrors the
 * calm busy state of an IDE agent: a small animated mark, the word Working,
 * the live stage, and a deterministic progress readout. No score lives here.
 */
export function ScanWorkingStatus({
  stageDetail,
  progress,
  current,
  total,
  className,
}: ScanWorkingStatusProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 border-b border-border/40 px-4 py-3',
        className
      )}
    >
      <ScanWorkingMark />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {REPORT_COPY.workspace.scan.working}
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-brand motion-safe:animate-pulse"
            aria-hidden
          />
        </p>
        <p className="truncate text-xs text-muted-foreground">{stageDetail}</p>
      </div>
      {/* Fixed width so the readout growing from 5% to 100% cannot reflow the stage detail. */}
      <div className="w-[5.5rem] shrink-0 text-right">
        <p className="font-mono text-sm font-semibold tabular-nums leading-none text-foreground">
          {progress}%
        </p>
        <p className="mt-1 text-2xs text-muted-foreground">
          {REPORT_COPY.workspace.scan.stepOf(current, total)}
        </p>
      </div>
    </div>
  )
}
