'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { GradeBadge } from '@/components/audit/GradeBadge'
import { AreaGrid } from '@/components/audit/AreaGrid'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Heading } from '@/components/ui/typography'
import { rankFindingsByPriority } from '@/lib/audit/priority-findings'
import type { ExampleAudit } from '@/lib/marketing/example-audits'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { areaLabel } from '@/lib/utils'

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
  const topIssues = rankFindingsByPriority(audit.areas, 3)
  const topPrompt = topIssues[0]?.finding.agentPrompt ?? topIssues[0]?.finding.fix

  return (
    <Card id={audit.id} className="scroll-mt-[var(--header-offset)] border-0 shadow-card">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
              {audit.tags.map((t) => TAG_LABELS[t] ?? t).join(' · ')}
            </p>
            <Heading as="h2" className="text-xl">
              {audit.url}
            </Heading>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{audit.pageType}</span>
              <span>·</span>
              <span className="line-clamp-1 italic">&ldquo;{audit.verdict}&rdquo;</span>
            </div>
          </div>
          <GradeBadge grade={audit.grade} score={audit.score} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            Top issues
          </p>
          <ul className="space-y-2">
            {topIssues.map(({ finding, areaName }) => (
              <li key={finding.id} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span className="flex-1 text-foreground/90">{finding.problem}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
                  {areaLabel(areaName)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {topPrompt && (
          <div className="rounded-nested-md bg-muted/20 p-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
              Sample fix prompt
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{topPrompt}</p>
            <PromptCopyButton prompt={topPrompt} compact />
          </div>
        )}

        {expanded && (
          <div className="space-y-5 border-t border-border/15 pt-5">
            <p className="text-sm text-muted-foreground italic text-pretty">
              &ldquo;{audit.verdict}&rdquo;
            </p>
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                All areas · Pipeline v{PIPELINE_VERSION}
              </p>
              <AreaGrid areas={audit.areas} showScoreTypes />
            </div>
          </div>
        )}

        <ThirdPartyAuditDisclaimer variant="compact" />

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
