import type { CodeFinding } from '@/lib/audit/code-checks/types'
import { buildRepoFindingFixTask } from '@/lib/repo-scan/finding-fix-task'

/** Deterministic IDE-agent prompt - no AI judge is involved in repo scanning. */
export function buildFindingPrompt(
  repoFullName: string,
  finding: CodeFinding,
  commitSha?: string | null
): string {
  return buildRepoFindingFixTask({
    repoFullName,
    commitSha: commitSha ?? null,
    severity: finding.severity,
    category: finding.category,
    filePath: finding.filePath,
    lineStart: finding.lineStart ?? null,
    lineEnd: finding.lineEnd ?? null,
    problem: finding.problem,
    evidence: finding.evidence,
    fix: finding.fix,
  }).prompt
}
