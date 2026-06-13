import { GlassCard } from '@/components/ui/glass-card'
import {
  SAMPLE_FINDINGS,
  SAMPLE_FINDINGS_FOOTER,
  SAMPLE_FINDINGS_HEADER,
  SAMPLE_FINDINGS_VERDICT,
} from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const GRADE_STYLES: Record<string, string> = {
  D: 'text-grade-D bg-grade-D/10',
  C: 'text-grade-C bg-grade-C/10',
  B: 'text-grade-B bg-grade-B/10',
}

export function SampleFindingsCard({ className }: { className?: string }) {
  return (
    <GlassCard variant="medium" className={cn('w-full overflow-hidden p-0 rounded-card', className)}>
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="font-mono text-[11px] uppercase tracking-label text-muted-foreground/80">
          {SAMPLE_FINDINGS_HEADER}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">stripe.com</span>
      </div>

      <div className="bg-muted/25 px-5 py-4">
        <p className="font-display text-[15px] leading-snug text-foreground/88 italic text-pretty">
          &ldquo;{SAMPLE_FINDINGS_VERDICT}&rdquo;
        </p>
      </div>

      <div className="space-y-0">
        {SAMPLE_FINDINGS.map((f) => (
          <div key={f.issue} className="flex items-start gap-3.5 px-5 py-3.5">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold tabular-nums',
                GRADE_STYLES[f.grade] ?? 'text-muted-foreground bg-muted'
              )}
            >
              {f.grade}
            </span>
            <div className="min-w-0 space-y-0.5 pt-0.5">
              <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
                {f.area}
              </span>
              <p className="text-sm leading-snug tracking-body text-pretty">{f.issue}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted/20 px-5 py-3">
        <span className="text-xs leading-[1.45] text-muted-foreground">{SAMPLE_FINDINGS_FOOTER}</span>
      </div>
    </GlassCard>
  )
}
