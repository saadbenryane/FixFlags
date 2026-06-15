import { ArrowRight } from 'lucide-react'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { ScoreCard } from '@/components/audit/ScoreCard'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { TextLink } from '@/components/ui/text-link'
import type { SampleResult } from '@/lib/marketing/live-sample'
import { gradeFromScore } from '@/lib/audit/scoring'
import {
  getTopFixPromptFromAreas,
  rankFindingsByPriority,
} from '@/lib/audit/priority-findings'
import { HERO_FIX_PROMPT, OUTPUT_LABELS, SAMPLE_FINDINGS_HEADER } from '@/lib/marketing/copy'
import { areaLabel, cn } from '@/lib/utils'
import { LabelCaps } from '@/components/ui/typography'

export function SampleFindingsCard({
  className,
  sample,
  variant = 'full',
}: {
  className?: string
  sample: SampleResult
  variant?: 'teaser' | 'full'
}) {
  const fixPrompt = getTopFixPromptFromAreas(sample.audit.areas)
  const priority = rankFindingsByPriority(sample.audit.areas, 3)
  const desktop = sample.audit.screenshots.find((item) => item.device === 'DESKTOP')
  const scoreGrade = sample.audit.score === null ? null : gradeFromScore(sample.audit.score)

  if (variant === 'teaser') {
    return (
      <div className={cn('overflow-hidden rounded-card border-0 bg-card shadow-card', className)}>
        <div className="space-y-3 px-5 py-4">
          <LabelCaps>{SAMPLE_FINDINGS_HEADER}</LabelCaps>
          <div className="min-w-0 space-y-2">
            <SampleStatusBadge
              source={sample.source}
              completedAt={sample.completedAt}
              pipelineVersion={sample.pipelineVersion}
            />
            <p className="truncate font-medium">{new URL(sample.audit.url).hostname}</p>
          </div>
          <ScoreCard grade={scoreGrade} score={sample.audit.score} label="Overall score" size="sm" />
        </div>

        <div className="divide-y divide-border/15 border-t border-border/15">
          {priority.map(({ finding, areaName, areaGrade }) => (
            <div key={finding.id} className="flex items-start gap-3 px-5 py-3">
              <ScoreCard
                areaName={areaName}
                grade={areaGrade}
                layout="compact"
                size="sm"
                className="mt-0.5 shrink-0 shadow-none"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium">{areaLabel(areaName)}</span>
                <p className="text-sm leading-snug text-muted-foreground line-clamp-2">
                  {finding.problem}
                </p>
              </div>
            </div>
          ))}
        </div>

        {fixPrompt && (
          <div className="space-y-2 border-t border-border/15 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
              {HERO_FIX_PROMPT.label}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {fixPrompt.prompt}
            </p>
            <PromptCopyButton prompt={fixPrompt.prompt} compact />
          </div>
        )}

        <div className="border-t border-border/15 px-5 py-4">
          <TextLink href="/samples" className="text-sm font-medium">
            {OUTPUT_LABELS.seeFullSample}
            <ArrowRight className="h-3.5 w-3.5" />
          </TextLink>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-card border-0 bg-card shadow-card', className)}>
      <div className="space-y-3 px-5 py-4">
        <div className="min-w-0 space-y-2">
          <SampleStatusBadge
            source={sample.source}
            completedAt={sample.completedAt}
            pipelineVersion={sample.pipelineVersion}
          />
          <p className="truncate font-medium">{new URL(sample.audit.url).hostname}</p>
        </div>
        <ScoreCard grade={scoreGrade} score={sample.audit.score} label="Overall score" size="sm" />
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
        <div className="space-y-2 border-t border-border/15 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            {HERO_FIX_PROMPT.label}
          </p>
          {fixPrompt.finding && <p className="text-xs font-medium">{fixPrompt.finding}</p>}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {fixPrompt.prompt}
          </p>
        </div>
      )}

      {sample.audit.verdict && (
        <div className="space-y-1.5 border-t border-border/15 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            Verdict
          </p>
          <p className="text-sm leading-relaxed text-pretty">{sample.audit.verdict}</p>
        </div>
      )}

      <div className="divide-y divide-border/15 border-t border-border/15">
        {priority.map(({ areaName, areaGrade, finding }) => (
          <div key={finding.id} className="flex items-start gap-3 px-5 py-3.5">
            <ScoreCard
              areaName={areaName}
              grade={areaGrade}
              layout="compact"
              size="sm"
              className="mt-0.5 shrink-0 shadow-none"
            />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium">{areaLabel(areaName)}</span>
              <p className="text-sm leading-snug text-muted-foreground">{finding.problem}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border/15 px-5 py-4">
        <ThirdPartyAuditDisclaimer variant="compact" showPipeline />
        <TextLink href="/samples" className="text-sm font-medium">
          {OUTPUT_LABELS.seeFullSample}
          <ArrowRight className="h-3.5 w-3.5" />
        </TextLink>
      </div>
    </div>
  )
}
