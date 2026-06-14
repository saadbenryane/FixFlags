import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { GradeBadge } from '@/components/audit/GradeBadge'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'

import type { SampleResult } from '@/lib/marketing/live-sample'
import { gradeFromScore } from '@/lib/audit/scoring'
import { cn } from '@/lib/utils'

function getTopFixPrompt(
  sample: SampleResult
): { label: string; prompt: string; finding?: string } | null {
  for (const area of sample.audit.areas) {
    for (const finding of area.findings) {
      const prompt = finding.cursorPrompt ?? finding.agentPrompt
      if (prompt) {
        return {
          label: 'Agent fix prompt',
          prompt,
          finding: finding.problem,
        }
      }
    }
  }
  return null
}

export function SampleFindingsCard({
  className,
  sample,
}: {
  className?: string
  sample: SampleResult
}) {
  const fixPrompt = getTopFixPrompt(sample)
  const desktop = sample.audit.screenshots.find((item) => item.device === 'DESKTOP')
  const priority = sample.audit.areas
    .flatMap((area) => area.findings.map((finding) => ({ area, finding })))
    .slice(0, 3)

  const scoreGrade =
    sample.audit.score === null
      ? null
      : gradeFromScore(sample.audit.score)

  return (
    <div className={cn('overflow-hidden rounded-card bg-card shadow-raised', className)}>
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 space-y-2">
          <SampleStatusBadge
            source={sample.source}
            completedAt={sample.completedAt}
            pipelineVersion={sample.pipelineVersion}
          />
          <p className="truncate font-medium">{new URL(sample.audit.url).hostname}</p>
        </div>
        <GradeBadge grade={scoreGrade} score={sample.audit.score} />
      </div>

      <div className="bg-muted/25 p-3">
        <BrowserFrame
          device="desktop"
          url={sample.audit.url}
          imageUrl={desktop?.url}
          state={desktop ? 'loaded' : 'failed'}
          label="Captured"
        />
      </div>

      {fixPrompt && (
        <div className="border-t border-border/15 px-5 py-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            {fixPrompt.label}
          </p>
          {fixPrompt.finding && (
            <p className="text-xs font-medium">{fixPrompt.finding}</p>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {fixPrompt.prompt}
          </p>
        </div>
      )}

      {sample.audit.verdict && (
        <div className="space-y-1.5 px-5 py-4 border-t border-border/15">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">Verdict</p>
          <p className="text-sm leading-relaxed text-pretty">{sample.audit.verdict}</p>
        </div>
      )}

      <div className="divide-y divide-border/15 border-t border-border/15">
        {priority.map(({ area, finding }) => (
          <div key={finding.id} className="flex items-start gap-3 px-5 py-3.5">
            <GradeBadge grade={area.grade} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium">{area.name.toLowerCase()}</span>
              <p className="text-sm leading-snug text-muted-foreground">{finding.problem}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-border/15">
        <Link
          href="/samples"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand link-underline-grow"
        >
          View full sample report
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
