import type { CodeFinding } from '@/lib/audit/code-checks/types'

/** Deterministic IDE-agent prompt - no AI judge is involved in repo scanning. */
export function buildFindingPrompt(repoFullName: string, finding: CodeFinding): string {
  const location = finding.lineStart
    ? `${finding.filePath}:${finding.lineStart}${finding.lineEnd && finding.lineEnd !== finding.lineStart ? `-${finding.lineEnd}` : ''}`
    : finding.filePath

  return [
    `Repo: ${repoFullName}`,
    `File: ${location}`,
    `Issue: ${finding.problem}`,
    `Evidence: ${finding.evidence}`,
    `Fix: ${finding.fix}`,
  ].join('\n')
}
