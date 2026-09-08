import { SCORE_HELP } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

/** Colocated like ScanWorkingMark so ScoreRing stays free of global keyframes.
 *  from/to must both be explicit. A `to`-only spin on the same node as
 *  `-rotate-90` interpolates -90deg → 360deg and snaps at the bottom. */
const SCORE_PENDING_KEYFRAMES = `@keyframes ff-score-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}`

function PendingDots({ size }: { size: 'md' | 'sm' }) {
  return (
    <span
      className={cn('flex items-center', size === 'sm' ? 'gap-[2px]' : 'gap-[3px]')}
      aria-hidden
    >
      <span
        className={cn(
          'rounded-full bg-foreground/55',
          size === 'sm' ? 'h-0.5 w-0.5' : 'h-1 w-1'
        )}
      />
      <span
        className={cn(
          'rounded-full bg-foreground/55',
          size === 'sm' ? 'h-0.5 w-0.5' : 'h-1 w-1'
        )}
      />
      <span
        className={cn(
          'rounded-full bg-foreground/55',
          size === 'sm' ? 'h-0.5 w-0.5' : 'h-1 w-1'
        )}
      />
    </span>
  )
}

export function ScoreRing({
  score,
  pending = false,
  size = 'md',
  className,
}: {
  score: number | null
  pending?: boolean
  size?: 'md' | 'sm'
  className?: string
}) {
  const normalized = score == null ? 0 : Math.min(100, Math.max(0, Math.round(score)))
  const valueLabel = pending ? 'Score pending' : score == null ? 'Score unavailable' : `Score ${normalized}`
  const label = `${valueLabel}. ${SCORE_HELP.diagnostic}`
  const strokeWidth = size === 'sm' ? 4 : 3

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full',
        size === 'sm' ? 'h-9 w-9' : 'h-16 w-16',
        className
      )}
      role="img"
      aria-label={label}
    >
      {pending ? <style>{SCORE_PENDING_KEYFRAMES}</style> : null}

      {/* Static track + completed score arc. Start-angle is an SVG attribute
          so CSS animation never shares a transform with it. */}
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        {!pending && score != null ? (
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="hsl(var(--brand))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${normalized} 100`}
            transform="rotate(-90 32 32)"
          />
        ) : null}
      </svg>

      {/* Brand arc spinner: CSS rotates a wrapper; SVG rotate(-90) starts at 12 o'clock. */}
      {pending ? (
        <div
          className="absolute inset-0 motion-safe:animate-[ff-score-spin_1.15s_linear_infinite]"
          aria-hidden
          data-score-spinner
        >
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="hsl(var(--brand))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="28 72"
              opacity="0.95"
              transform="rotate(-90 32 32)"
            />
          </svg>
        </div>
      ) : null}

      <span
        className={cn(
          'relative z-[1] flex items-center justify-center font-mono font-semibold leading-none tabular-nums text-foreground',
          size === 'sm' ? 'text-2xs' : 'text-lg'
        )}
      >
        {pending ? <PendingDots size={size} /> : score == null ? '–' : normalized}
      </span>
    </div>
  )
}
