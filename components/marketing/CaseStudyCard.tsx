'use client'

import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { TextLink } from '@/components/ui/text-link'
import { gradeFromScore } from '@/lib/audit/scoring'
import type { RubricGrade } from '@prisma/client'
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
  gradeBefore?: RubricGrade
  gradeAfter?: RubricGrade
  link: string
  proofLink?: string
  proofType?: string
}

const GRADE_ONLY_AREAS = new Set(['Conversion', 'Trust', 'Content'])

function beforeGrade(study: CaseStudy): RubricGrade | null {
  if (GRADE_ONLY_AREAS.has(study.area) && study.gradeBefore) {
    return study.gradeBefore
  }
  if (study.scoreBefore != null) {
    return gradeFromScore(study.scoreBefore)
  }
  return null
}

function afterGrade(study: CaseStudy): RubricGrade {
  if (GRADE_ONLY_AREAS.has(study.area) && study.gradeAfter) {
    return study.gradeAfter
  }
  return gradeFromScore(study.scoreAfter ?? 0)
}

function formatMetric(value: string | number, grade: RubricGrade | null): string {
  if (grade) return `${value} (${grade})`
  return String(value)
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

function scoreDelta(study: CaseStudy): number | null {
  if (
    study.scoreBefore != null &&
    study.scoreAfter != null &&
    !GRADE_ONLY_AREAS.has(study.area)
  ) {
    return study.scoreAfter - study.scoreBefore
  }
  return null
}

export function CaseStudyCard({ study }: { study: CaseStudy }) {
  const proofHref = study.proofLink ?? study.link
  const before = beforeValue(study)
  const after = afterValue(study)
  const beforeG = beforeGrade(study)
  const afterG = afterGrade(study)
  const delta = scoreDelta(study)
  const hasMetrics = before !== after || beforeG || afterG

  return (
    <Card interactive className="flex h-full flex-col overflow-hidden border-0 shadow-card">
      <CardContent className="flex flex-1 flex-col space-y-4 p-5 sm:p-6">
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

        {hasMetrics ? (
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-md bg-muted/30 px-4 py-3">
            <span className="font-mono text-lg font-bold tabular-nums text-muted-foreground sm:text-xl">
              {formatMetric(before, beforeG)}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span className="font-mono text-lg font-bold tabular-nums text-brand sm:text-xl">
              {formatMetric(after, afterG)}
            </span>
            {delta != null && delta > 0 ? (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                +{delta}
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">
          {study.outcome}
        </p>
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
