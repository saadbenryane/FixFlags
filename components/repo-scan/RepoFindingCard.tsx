'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, GitCommitHorizontal } from 'lucide-react'
import { SeverityBadge } from '@/components/audit/SeverityBadge'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import type { RepoScanFinding } from '@/hooks/useRepoScanPolling'
import { buildRepoFindingFixTask } from '@/lib/repo-scan/finding-fix-task'

interface Props {
  finding: RepoScanFinding
  repoFullName: string
  commitSha: string | null
  defaultExpanded?: boolean
}

function locationLabel(finding: RepoScanFinding): string {
  if (finding.lineStart && finding.lineEnd && finding.lineEnd !== finding.lineStart) {
    return `${finding.filePath}:${finding.lineStart}-${finding.lineEnd}`
  }
  if (finding.lineStart) return `${finding.filePath}:${finding.lineStart}`
  return finding.filePath
}

export function RepoFindingCard({
  finding,
  repoFullName,
  commitSha,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const fixTask = buildRepoFindingFixTask({
    repoFullName,
    commitSha,
    severity: finding.severity,
    category: finding.category,
    filePath: finding.filePath,
    lineStart: finding.lineStart,
    lineEnd: finding.lineEnd,
    problem: finding.problem,
    evidence: finding.evidence,
    fix: finding.fix,
  })

  return (
    <div className="relative border-b border-border/60 last:border-b-0">
      <div className="px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <span className="meta-label text-muted-foreground/80">{finding.category}</span>
            </div>
            <p className="text-sm font-medium leading-snug text-pretty">{finding.problem}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              <span className="break-all font-mono sm:truncate">{locationLabel(finding)}</span>
              <span className="hidden text-border sm:inline">/</span>
              <span className="inline-flex min-w-0 items-center gap-1 font-mono">
                <GitCommitHorizontal className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{fixTask.branchName}</span>
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1 sm:justify-start">
            <PromptCopyButton prompt={fixTask.prompt} label="Copy branch prompt" compact />
            <button
              onClick={() => setExpanded(!expanded)}
              className="min-h-11 min-w-11 rounded-pill p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
              <p className="meta-label text-muted-foreground">Where</p>
              <p className="rounded-md bg-muted/50 px-2 py-1.5 font-mono text-xs leading-relaxed text-pretty text-muted-foreground">
                {finding.evidence || 'No evidence captured.'}
              </p>
            </div>

            <div className="grid gap-2 rounded-[var(--radius-inner)] bg-muted/35 p-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <p className="meta-label text-muted-foreground">Branch</p>
                <p className="truncate font-mono text-xs text-foreground">{fixTask.branchName}</p>
              </div>
              <div className="min-w-0 space-y-1">
                <p className="meta-label text-muted-foreground">Commit</p>
                <p className="truncate font-mono text-xs text-foreground">
                  {fixTask.commitMessage}
                </p>
              </div>
            </div>

            {finding.fix && (
              <div className="space-y-1">
                <p className="meta-label text-muted-foreground">Fix</p>
                <p className="text-sm text-pretty text-foreground/90">{finding.fix}</p>
              </div>
            )}

            <div className="space-y-1">
              <p className="meta-label text-muted-foreground">Verify</p>
              <ul className="space-y-1.5">
                {fixTask.verification.map((step) => (
                  <li key={step} className="flex gap-2 text-sm text-foreground/90">
                    <CheckCircle2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    <span className="text-pretty">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            <FixPromptBlock prompt={fixTask.prompt} rows={4} clamp={false} nested />
          </div>
        )}
      </div>
    </div>
  )
}
