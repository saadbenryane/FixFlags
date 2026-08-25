import { cn } from '@/lib/utils'

export function ScoreRing({ score, pending = false, className }: { score: number | null; pending?: boolean; className?: string }) {
  const normalized = score == null ? 0 : Math.min(100, Math.max(0, Math.round(score)))
  const label = pending ? 'Score pending' : score == null ? 'Score unavailable' : `Score ${normalized}`
  return (
    <div className={cn('relative grid h-16 w-16 shrink-0 place-items-center rounded-full', className)} role="img" aria-label={label}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        {!pending && score != null ? <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--brand))" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray={`${normalized} 100`} /> : null}
      </svg>
      <span className="font-mono text-lg font-semibold tabular-nums text-foreground">{pending ? '…' : score == null ? '—' : normalized}</span>
    </div>
  )
}
