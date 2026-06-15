'use client'

import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { TextLink } from '@/components/ui/text-link'
import { GradeBadge } from '@/components/audit/GradeBadge'
import { gradeFromScore } from '@/lib/audit/scoring'
import type { AreaGrade } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface CaseStudy {
  id: string
  company: string
  title: string
  outcome: string
  area: string
  scoreBefore?: number
  scoreAfter?: number
  gradeBefore?: AreaGrade
  gradeAfter?: AreaGrade
  link: string
  proofLink?: string
  proofType?: string
}

const GRADE_ONLY_AREAS = new Set(['Conversion', 'Trust', 'Content'])

function formatDelta(study: CaseStudy): string | null {
  if (GRADE_ONLY_AREAS.has(study.area) && study.gradeBefore && study.gradeAfter) {
    return `${study.gradeBefore} → ${study.gradeAfter}`
  }
  if (study.scoreBefore != null && study.scoreAfter != null) {
    return `${study.scoreBefore} → ${study.scoreAfter}`
  }
  return null
}

function afterGrade(study: CaseStudy): AreaGrade {
  if (GRADE_ONLY_AREAS.has(study.area) && study.gradeAfter) {
    return study.gradeAfter
  }
  return gradeFromScore(study.scoreAfter ?? 0)
}

function beforeValue(study: CaseStudy): string {
  if (GRADE_ONLY_AREAS.has(study.area) && study.gradeBefore) {
    return study.gradeBefore
  }
  return String(study.scoreBefore ?? 0)
}

function afterValue(study: CaseStudy): string {
  if (GRADE_ONLY_AREAS.has(study.area) && study.gradeAfter) {
    return study.gradeAfter
  }
  return String(study.scoreAfter ?? 0)
}

export function CaseStudyCard({ study }: { study: CaseStudy }) {
  const proofHref = study.proofLink ?? study.link
  const delta = formatDelta(study)
  const before = beforeValue(study)
  const after = afterValue(study)

  return (
    <Card interactive className="overflow-hidden border-0 shadow-card">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px] font-mono uppercase tracking-label">
            {study.area}
          </Badge>
          {study.proofType ? (
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-label">
              {study.proofType}
            </Badge>
          ) : null}
        </div>

        <h3 className="font-display text-lg leading-snug tracking-display">{study.title}</h3>

        {delta ? (
          <div className="flex items-center justify-center gap-3 rounded-md bg-muted/30 px-4 py-3">
            <span className="font-mono text-xl font-bold tabular-nums text-muted-foreground">
              {before}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span className="font-mono text-xl font-bold tabular-nums text-brand">
              {after}
            </span>
            <GradeBadge grade={afterGrade(study)} size="sm" className="ml-1" />
          </div>
        ) : null}

        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{study.outcome}</p>
      </CardContent>

      <div className="px-5 py-3 sm:px-6">
        <TextLink href={proofHref} className="font-mono text-[10px] uppercase tracking-label">
          See proof in sample audit
          <ArrowUpRight className="h-3 w-3" />
        </TextLink>
      </div>
    </Card>
  )
}
