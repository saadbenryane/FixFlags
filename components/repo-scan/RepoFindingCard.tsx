'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SeverityBadge } from '@/components/audit/SeverityBadge'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import type { RepoScanFinding } from '@/hooks/useRepoScanPolling'

interface Props {
  finding: RepoScanFinding
  defaultExpanded?: boolean
}

function locationLabel(finding: RepoScanFinding): string {
  if (finding.lineStart && finding.lineEnd && finding.lineEnd !== finding.lineStart) {
    return `${finding.filePath}:${finding.lineStart}-${finding.lineEnd}`
  }
  if (finding.lineStart) return `${finding.filePath}:${finding.lineStart}`
  return finding.filePath
}

export function RepoFindingCard({ finding, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const fixPrompt = finding.agentPrompt || finding.fix

  return (
    <div className="relative border-b border-border/60 last:border-b-0">
      <div className="px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
                {finding.category}
              </span>
            </div>
            <p className="text-sm font-medium leading-snug text-pretty">{finding.problem}</p>
            <p className="break-all font-mono text-[10px] text-muted-foreground sm:truncate">
              {locationLabel(finding)}
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1 sm:justify-start">
            <PromptCopyButton prompt={fixPrompt} label="Copy fix prompt" compact />
            <button
              onClick={() => setExpanded(!expanded)}
              className="min-h-11 min-w-11 p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 ml-0.5 space-y-3 border-l border-border/60 pl-3">
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                Where
              </p>
              <p className="rounded-md bg-muted/50 px-2 py-1.5 font-mono text-xs leading-relaxed text-pretty text-muted-foreground">
                {finding.evidence || 'No evidence captured.'}
              </p>
            </div>

            {finding.fix && (
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                  Fix
                </p>
                <p className="text-sm text-pretty text-foreground/90">{finding.fix}</p>
              </div>
            )}

            <FixPromptBlock prompt={fixPrompt} rows={4} clamp={false} nested />
          </div>
        )}
      </div>
    </div>
  )
}
