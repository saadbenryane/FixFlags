import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { GradeBadge } from '@/components/audit/GradeBadge'
import { gradeFromScore } from '@/lib/audit/scoring'

interface CaseStudy {
  id: string
  company: string
  title: string
  issue: string
  fix: string
  outcome: string
  area: string
  scoreBefore: number
  scoreAfter: number
  link: string
}

export function CaseStudyCard({ study, index }: { study: CaseStudy; index: number }) {
  return (
    <div className="overflow-hidden rounded-card border-0 bg-card shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="h-3 w-px bg-border/30" />
          <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
            {study.company}
          </span>
        </div>

        <h3 className="mb-3 font-display text-lg leading-snug tracking-display">{study.title}</h3>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/30 px-3 py-2.5 text-center">
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">Before</p>
            <p className="font-mono text-xl font-bold tabular-nums text-muted-foreground">{study.scoreBefore}</p>
            <GradeBadge grade={gradeFromScore(study.scoreBefore)} size="sm" className="mt-0.5 justify-center" />
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2.5 text-center">
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">After</p>
            <p className="font-mono text-xl font-bold tabular-nums text-grade-A">{study.scoreAfter}</p>
            <GradeBadge grade={gradeFromScore(study.scoreAfter)} size="sm" className="mt-0.5 justify-center" />
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">Issue</p>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{study.issue}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">Fix</p>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{study.fix}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">Outcome</p>
            <p className="text-sm font-medium leading-relaxed text-foreground text-pretty">{study.outcome}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border/15 px-5 py-3 sm:px-6 space-y-2">
        <ThirdPartyAuditDisclaimer variant="compact" />
        <Link
          href={study.link}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-brand transition-colors hover:text-brand/80"
        >
          See related example
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
