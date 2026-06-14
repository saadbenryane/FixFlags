import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GradeBadge } from '@/components/audit/GradeBadge'
import {
  HERO,
  HERO_SAMPLE,
  SAMPLE_FINDINGS,
  SAMPLE_FINDINGS_FOOTER,
  SAMPLE_FINDINGS_HEADER,
  SAMPLE_FINDINGS_VERDICT,
} from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

function scoreTone(score: number): string {
  if (score >= 80) return 'text-grade-A bg-grade-A/10 border-grade-A/25'
  if (score >= 60) return 'text-grade-C bg-grade-C/10 border-grade-C/25'
  if (score >= 40) return 'text-grade-D bg-grade-D/10 border-grade-D/25'
  return 'text-grade-F bg-grade-F/10 border-grade-F/25'
}

export function SampleFindingsCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-card border-0 bg-card shadow-raised transition-shadow duration-300 hover:shadow-card-hover',
        className
      )}
    >
      {/* Report header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 space-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
            {SAMPLE_FINDINGS_HEADER}
          </p>
          <p className="truncate font-medium">{HERO_SAMPLE.domain}</p>
          <p className="text-xs text-muted-foreground">{HERO_SAMPLE.pageType}</p>
        </div>
        <div
          className={cn(
            'shrink-0 rounded-md border px-3 py-2 text-center',
            scoreTone(HERO_SAMPLE.score)
          )}
        >
          <div className="font-mono text-2xl font-bold tabular-nums leading-none">{HERO_SAMPLE.score}</div>
          <div className="mt-0.5 font-mono text-[10px] opacity-70">/100</div>
        </div>
      </div>

      {/* Screenshot preview — matches real audit report */}
      <div className="bg-muted/25 px-3 pb-3 pt-0">
        <div className="grid grid-cols-[1fr_4.5rem] gap-2">
          <div className="relative overflow-hidden rounded-nested-md outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
            <div className="relative aspect-[1280/900] w-full">
              <Image
                src="/samples/stripe-desktop.webp"
                alt="Desktop screenshot preview"
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 280px, 360px"
                priority
              />
            </div>
          </div>
          <div className="relative overflow-hidden rounded-nested-sm outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
            <div className="relative aspect-[375/812] w-full">
              <Image
                src="/samples/stripe-mobile.webp"
                alt="Mobile screenshot preview"
                fill
                className="object-cover object-top"
                sizes="72px"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI verdict */}
      <div className="space-y-1.5 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">AI verdict</p>
        <p className="text-sm leading-relaxed text-pretty">{SAMPLE_FINDINGS_VERDICT}</p>
      </div>

      {/* Findings */}
      <div className="divide-y divide-border/15 border-t border-border/15">
        {SAMPLE_FINDINGS.map((f) => (
          <div key={f.issue} className="flex items-start gap-3 px-5 py-3.5">
            <GradeBadge grade={f.grade} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <span className="text-xs font-medium">{f.area}</span>
              <p className="text-sm leading-snug text-muted-foreground text-pretty">{f.issue}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-4 rounded-nested-bottom-md bg-muted/20 px-5 py-3.5">
        <span className="text-xs leading-[1.45] text-muted-foreground">{SAMPLE_FINDINGS_FOOTER}</span>
        <Link
          href="/samples"
          className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-label text-brand transition-colors hover:text-brand/80"
        >
          {HERO.secondaryCta}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
