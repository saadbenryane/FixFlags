'use client'

import { Loader2, GitBranch, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import { Container } from '@/components/ui/container'
import { RepoFindingCard } from '@/components/repo-scan/RepoFindingCard'
import { useRepoScanPolling, type RepoScan, type RepoScanFinding } from '@/hooks/useRepoScanPolling'
import { severityRank } from '@/lib/utils'

const STAGE_LABEL: Record<string, string> = {
  QUEUED: 'Queued',
  CLONING: 'Cloning repository…',
  SCANNING: 'Scanning code…',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

function shortSha(sha: string | null): string | null {
  return sha ? sha.slice(0, 7) : null
}

function sortedFindings(findings: RepoScanFinding[]): RepoScanFinding[] {
  return [...findings].sort((a, b) => {
    const rank = severityRank(a.severity) - severityRank(b.severity)
    if (rank !== 0) return rank
    return a.filePath.localeCompare(b.filePath)
  })
}

function countBySeverity(findings: RepoScanFinding[]) {
  return {
    critical: findings.filter((f) => f.severity === 'CRITICAL').length,
    important: findings.filter((f) => f.severity === 'IMPORTANT').length,
    polish: findings.filter((f) => f.severity === 'POLISH').length,
  }
}

export function RepoScanReport({ initialScan }: { initialScan: RepoScan }) {
  const { scan, status, isComplete, isFailed } = useRepoScanPolling(initialScan.id, initialScan)
  const current = scan ?? initialScan
  const inProgress = !isComplete && !isFailed

  const findings = sortedFindings(current.findings ?? [])
  const counts = countBySeverity(findings)

  return (
    <Container variant="report" className="space-y-6 py-6 sm:py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-mono text-lg font-semibold tracking-heading">{current.repoFullName}</h1>
          {shortSha(current.commitSha) && (
            <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              {shortSha(current.commitSha)}
            </span>
          )}
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {inProgress && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
          {STAGE_LABEL[status] ?? status}
        </p>
      </header>

      {isFailed && (
        <Callout variant="danger">
          {current.errorMsg || 'The scan failed before it could finish. Try running it again.'}
        </Callout>
      )}

      {isComplete && findings.length === 0 && (
        <Card className="border-0 shadow-card">
          <div className="flex items-center gap-3 px-4 py-6">
            <ShieldCheck className="h-6 w-6 shrink-0 text-success" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">No issues found</p>
              <p className="text-sm text-muted-foreground">
                The deterministic code checks did not flag anything in this repository.
              </p>
            </div>
          </div>
        </Card>
      )}

      {findings.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 meta-label text-muted-foreground">
            <span>{findings.length} findings</span>
            {counts.critical > 0 && <span className="text-destructive">{counts.critical} critical</span>}
            {counts.important > 0 && <span className="text-warning">{counts.important} important</span>}
            {counts.polish > 0 && <span>{counts.polish} polish</span>}
          </div>
          <Card className="overflow-hidden border-0 shadow-card">
            {findings.map((finding) => (
              <RepoFindingCard
                key={finding.id}
                finding={finding}
                repoFullName={current.repoFullName}
                commitSha={current.commitSha}
              />
            ))}
          </Card>
        </>
      )}

      {inProgress && findings.length === 0 && (
        <Card className="border-0 shadow-card">
          <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            Analyzing the codebase. Findings will appear here as soon as the scan completes.
          </div>
        </Card>
      )}
    </Container>
  )
}
