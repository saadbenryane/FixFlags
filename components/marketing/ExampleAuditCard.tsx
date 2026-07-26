'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { RubricSummaryGrid } from '@/components/audit/RubricSummaryGrid'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { ScoreDisplay } from '@/components/audit/ScoreDisplay'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Heading } from '@/components/ui/typography'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { rankFlagsByPriority } from '@/lib/audit/priority-flags'
import type { ExampleAudit } from '@/lib/marketing/example-audits'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { rubricLabel } from '@/lib/utils'

const TAG_LABELS: Record<string, string> = {
  'best-practices': 'Best practices benchmark',
  marketing: 'Marketing site example',
  'content-heavy': 'Content-heavy page',
  'agency-ready': 'Agency-ready',
}

interface Props {
  audit: ExampleAudit
}

export function ExampleAuditCard({ audit }: Props) {
  const [expanded, setExpanded] = useState(false)
  const topIssues = rankFlagsByPriority(
    audit.flags,
    audit.rubrics.map((r) => ({ name: r.name, grade: r.grade })),
    3
  )
  const topPrompt = topIssues[0]?.flag.agentPrompt ?? topIssues[0]?.flag.fix
  const rubrics = computeRubricsFromRows(
    audit.rubrics.map((r) => ({
      name: r.name,
      grade: r.grade,
      score: r.score,
      flags: audit.flags.filter((f) => f.rubric === r.name).map((f) => ({ severity: f.severity })),
    })),
    audit.flags
  )

  return (
    <Card id={audit.id} variant="subtle" className="scroll-mt-[var(--header-offset)]">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="meta-label text-muted-foreground">
              {audit.tags.map((t) => TAG_LABELS[t] ?? t).join(' · ')}
            </p>
            <Heading as="h2" className="text-xl">
              {audit.url}
            </Heading>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{audit.pageType}</span>
              <span>·</span>
              <span className="line-clamp-1 border-l-2 border-brand/40 pl-2 text-foreground/90">
                {audit.verdict}
              </span>
            </div>
          </div>
          <ScoreDisplay grade={audit.grade} score={audit.score} variant="inline" />
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <div className="space-y-2">
          <p className="meta-label text-muted-foreground">
            Top flags
          </p>
          <ul className="space-y-2">
            {topIssues.map(({ flag, rubricName }) => (
              <li key={flag.id} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span className="flex-1 text-foreground/90">{flag.problem}</span>
                <span className="shrink-0 font-mono text-3xs uppercase text-muted-foreground">
                  {rubricLabel(rubricName)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {topPrompt && (
          <div className="rounded-nested-md bg-muted/20 p-4">
            <FixPromptBlock prompt={topPrompt} rows={3} clamp nested />
          </div>
        )}

        {expanded && (
          <div className="space-y-5 border-t border-border/15 pt-5">
            <p className="text-sm text-muted-foreground text-pretty">
              &ldquo;{audit.verdict}&rdquo;
            </p>
            <div className="space-y-2">
              <p className="meta-label text-muted-foreground">
                Rubrics · Pipeline v{PIPELINE_VERSION}
              </p>
              <RubricSummaryGrid rubrics={rubrics} />
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide details' : 'View details'}
          {expanded ? (
            <ChevronUp className="ml-2 h-4 w-4" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
