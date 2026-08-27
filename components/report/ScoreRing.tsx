import { cn } from '@/lib/utils'

/** Colocated like ScanWorkingMark so ScoreRing stays free of global keyframes. */
const SCORE_PENDING_KEYFRAMES = `@keyframes ff-score-spin {
  to { transform: rotate(360deg); }
}`

function PendingDots() {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden>
      <span className="h-1 w-1 rounded-full bg-foreground/55" />
      <span className="h-1 w-1 rounded-full bg-foreground/55" />
      <span className="h-1 w-1 rounded-full bg-foreground/55" />
    </span>
  )
}

export function ScoreRing({
  score,
  pending = false,
  className,
}: {
  score: number | null
  pending?: boolean
  className?: string
}) {
  const normalized = score == null ? 0 : Math.min(100, Math.max(0, Math.round(score)))
  const label = pending ? 'Score pending' : score == null ? 'Score unavailable' : `Score ${normalized}`

  return (
    <div
      className={cn(
        'relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full',
        className
      )}
      role="img"
      aria-label={label}
    >
      {pending ? <style>{SCORE_PENDING_KEYFRAMES}</style> : null}

      {/* Static track + completed score arc */}
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        {!pending && score != null ? (
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="hsl(var(--brand))"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${normalized} 100`}
          />
        ) : null}
      </svg>

      {/* Brand arc spinner while the score is still loading */}
      {pending ? (
        <svg
          viewBox="0 0 64 64"
          className="absolute inset-0 h-full w-full -rotate-90 motion-safe:animate-[ff-score-spin_1.15s_linear_infinite]"
          aria-hidden
        >
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="hsl(var(--brand))"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="28 100"
            opacity="0.95"
          />
        </svg>
      ) : null}

      <span className="relative z-[1] flex items-center justify-center font-mono text-lg font-semibold leading-none tabular-nums text-foreground">
        {pending ? <PendingDots /> : score == null ? '–' : normalized}
      </span>
    </div>
  )
}
