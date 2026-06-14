'use client'

import { ArrowUpRight } from 'lucide-react'
import { TextLink } from '@/components/ui/text-link'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { GradeBadge } from '@/components/audit/GradeBadge'
import { gradeFromScore } from '@/lib/audit/scoring'
import type { AreaGrade } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface CaseStudy {
  id: string
  company: string
  title: string
  issue: string
  fix: string
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

function beforeDisplay(study: CaseStudy): { primary: string; grade: AreaGrade } {
  if (GRADE_ONLY_AREAS.has(study.area) && study.gradeBefore) {
    return { primary: study.gradeBefore, grade: study.gradeBefore }
  }
  const score = study.scoreBefore ?? 0
  return { primary: String(score), grade: gradeFromScore(score) }
}

function afterDisplay(study: CaseStudy): { primary: string; grade: AreaGrade } {
  if (GRADE_ONLY_AREAS.has(study.area) && study.gradeAfter) {
    return { primary: study.gradeAfter, grade: study.gradeAfter }
  }
  const score = study.scoreAfter ?? 0
  return { primary: String(score), grade: gradeFromScore(score) }
}

export function CaseStudyCard({ study, index }: { study: CaseStudy; index: number }) {
  const proofHref = study.proofLink ?? study.link
  const before = beforeDisplay(study)
  const after = afterDisplay(study)
  const gradeOnly = GRADE_ONLY_AREAS.has(study.area)

  return (
    <Card interactive className="overflow-hidden border-0 shadow-card">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="h-3 w-px bg-border/30" />
          <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
            {study.company}
          </span>
          {study.proofType ? (
            <Badge variant="secondary" className="text-[10px] font-mono uppercase tracking-label">
              {study.proofType}
            </Badge>
          ) : null}
        </div>

        <h3 className="mb-3 font-display text-lg leading-snug tracking-display">{study.title}</h3>

        <p className="mb-3 font-mono text-[10px] uppercase tracking-label text-muted-foreground/70">
          {study.area} area · illustrative improvement
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/30 px-3 py-2.5 text-center">
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">Before</p>
            <p className="font-mono text-xl font-bold tabular-nums text-muted-foreground">
              {gradeOnly ? `Grade ${before.primary}` : before.primary}
            </p>
            <GradeBadge grade={before.grade} size="sm" className="mt-0.5 justify-center" />
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2.5 text-center">
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">After</p>
            <p className="font-mono text-xl font-bold tabular-nums text-grade-A">
              {gradeOnly ? `Grade ${after.primary}` : after.primary}
            </p>
            <GradeBadge grade={after.grade} size="sm" className="mt-0.5 justify-center" />
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">What changed</p>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{study.fix}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/60">Outcome</p>
            <p className="text-sm font-medium leading-relaxed text-foreground text-pretty">{study.outcome}</p>
          </div>
        </div>
      </CardContent>

      <div className="space-y-2 px-5 py-3 sm:px-6">
        <ThirdPartyAuditDisclaimer variant="compact" />
        <TextLink href={proofHref} className="font-mono text-[10px] uppercase tracking-label">
          See proof in sample audit
          <ArrowUpRight className="h-3 w-3" />
        </TextLink>
      </div>
    </Card>
  )
}
