import { CheckCircle2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { SAMPLE_FINDINGS, SAMPLE_FINDINGS_FOOTER } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const GRADE_STYLES: Record<string, string> = {
  D: 'text-grade-D bg-grade-D/10',
  C: 'text-grade-C bg-grade-C/10',
  B: 'text-grade-B bg-grade-B/10',
}

export function SampleFindingsCard({ className }: { className?: string }) {
  return (
    <GlassCard
      variant="medium"
      className={cn(
        'w-full overflow-hidden p-0 shadow-card-hover ring-1 ring-border/60 rounded-card',
        className
      )}
    >
      {/* Concentric top: inner radius = outer − header padding (12px) */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3 rounded-nested-top-md">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
          <div className="h-2.5 w-2.5 rounded-full bg-brand/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
        </div>
        <span className="ml-1 font-mono text-[11px] uppercase tracking-label text-muted-foreground">
          Sample audit results
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {SAMPLE_FINDINGS.map((f) => (
          <div key={f.issue} className="flex items-start gap-3 px-4 py-3.5">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold tabular-nums',
                GRADE_STYLES[f.grade] ?? 'text-muted-foreground bg-muted'
              )}
            >
              {f.grade}
            </span>
            <div className="min-w-0 space-y-0.5 pt-0.5">
              <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                {f.area}
              </span>
              <p className="text-sm leading-snug tracking-body text-pretty">{f.issue}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t bg-muted/25 px-4 py-3 rounded-nested-bottom-md">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
        <span className="text-xs leading-[1.45] text-muted-foreground">{SAMPLE_FINDINGS_FOOTER}</span>
      </div>
    </GlassCard>
  )
}
