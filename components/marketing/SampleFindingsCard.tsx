'use client'

import { ArrowRight } from 'lucide-react'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { ScoreDisplay } from '@/components/audit/ScoreDisplay'
import { ScoreCard } from '@/components/audit/ScoreCard'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'
import { TextLink } from '@/components/ui/text-link'
import type { SampleResult } from '@/lib/marketing/live-sample'
import { gradeFromScore } from '@/lib/audit/scoring'
import {
  getTopFixPromptFromAreas,
  rankFindingsByPriority,
} from '@/lib/audit/priority-findings'
import { OUTPUT_LABELS } from '@/lib/marketing/copy'
import { getSampleSiteDisplay } from '@/lib/marketing/display-meta'
import { areaLabel, cn } from '@/lib/utils'

export function SampleFindingsCard({
  className,
  sample,
  variant = 'full',
}: {
  className?: string
  sample: SampleResult
  variant?: 'teaser' | 'full'
}) {
  const priority = rankFindingsByPriority(sample.audit.areas, variant === 'teaser' ? 1 : 3)
  const fixPrompt = variant === 'full' ? getTopFixPromptFromAreas(sample.audit.areas) : null
  const topFinding = priority[0]
  const desktop = sample.audit.screenshots.find((item) => item.device === 'DESKTOP')
  const scoreGrade = sample.audit.score === null ? null : gradeFromScore(sample.audit.score)
  const site = getSampleSiteDisplay(sample.audit.url)

  if (variant === 'teaser') {
    return (
      <div className={cn('overflow-hidden rounded-card border-0 bg-card shadow-card', className)}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 space-y-1">
            <SampleStatusBadge
              source={sample.source}
              completedAt={sample.completedAt}
              isDogfood={site.isDogfood}
              marketing
            />
          </div>
          {scoreGrade && sample.audit.score != null ? (
            <ScoreDisplay
              grade={scoreGrade}
              score={sample.audit.score}
              variant="inline"
            />
          ) : null}
        </div>

        <div className="relative border-y border-border/15 bg-muted/20 px-3 py-3">
          <BrowserFrame
            device="desktop"
            url={site.browserUrl}
            imageUrl={desktop?.url}
            state={desktop ? 'loaded' : 'failed'}
            className="shadow-none ring-1 ring-inset ring-border/40"
          />
        </div>

        {topFinding ? (
          <div className="flex items-start gap-3 px-5 py-4">
            <ScoreCard
              areaName={topFinding.areaName}
              grade={topFinding.areaGrade}
              layout="compact"
              size="sm"
              className="mt-0.5 shrink-0 shadow-none"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-xs font-medium">{areaLabel(topFinding.areaName)}</span>
              <p className="text-sm leading-snug text-muted-foreground text-pretty">
                {topFinding.finding.problem}
              </p>
            </div>
          </div>
        ) : null}

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
        <SampleStatusBadge
          source={sample.source}
          completedAt={sample.completedAt}
          pipelineVersion={sample.pipelineVersion}
          isDogfood={site.isDogfood}
          marketing
        />
        <ScoreCard grade={scoreGrade} score={sample.audit.score} label="Overall score" size="sm" />
      </div>

      <div className="bg-muted/25 p-3">
        <BrowserFrame
          device="desktop"
          url={site.browserUrl}
          imageUrl={desktop?.url}
          state={desktop ? 'loaded' : 'failed'}
        />
      </div>

      {fixPrompt ? (
        <div className="border-t border-border/15 px-5 py-4">
          <FixPromptBlock
            prompt={fixPrompt.prompt}
            finding={fixPrompt.finding}
            rows={4}
            clamp={false}
            showNextStep
          />
        </div>
      ) : null}

      {sample.audit.verdict ? (
        <div className="space-y-1.5 border-t border-border/15 px-5 py-4">
          <p className="text-sm leading-relaxed text-pretty">{sample.audit.verdict}</p>
        </div>
      ) : null}

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

      <div className="border-t border-border/15 px-5 py-4">
        <TextLink href="/samples" className="text-sm font-medium">
          {OUTPUT_LABELS.seeFullSample}
          <ArrowRight className="h-3.5 w-3.5" />
        </TextLink>
      </div>
    </div>
  )
}
