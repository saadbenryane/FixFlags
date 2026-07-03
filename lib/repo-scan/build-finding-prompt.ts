import type { CodeFinding } from '@/lib/audit/code-checks/types'

/** Deterministic IDE-agent prompt - no AI judge is involved in repo scanning. */
export function buildFindingPrompt(
  repoFullName: string,
  finding: CodeFinding,
  commitSha?: string | null
): string {
  const location = finding.lineStart
    ? `${finding.filePath}:${finding.lineStart}${finding.lineEnd && finding.lineEnd !== finding.lineStart ? `-${finding.lineEnd}` : ''}`
    : finding.filePath
  const verification = [
    `Inspect ${location} and confirm the flagged issue is gone.`,
    'Run the narrowest relevant unit, lint, or typecheck command for the touched file.',
    'Confirm no unrelated files or behavior changed.',
  ]

  return [
    `Fix this repository finding in ${repoFullName}.`,
    '',
    `Base commit: ${commitSha ?? 'unknown'}`,
    `File: ${location}`,
    `Severity: ${finding.severity}`,
    `Category: ${finding.category}`,
    '',
    `Problem: ${finding.problem}`,
    `Evidence: ${finding.evidence}`,
    '',
    'Fix:',
    finding.fix,
    '',
    'Constraints:',
    '1. Keep the patch scoped to this finding unless a directly required supporting change is needed.',
    '2. Do not rewrite unrelated code or change product behavior outside the fix.',
    '3. Preserve existing style, framework patterns, and public APIs.',
    '4. Do not commit secrets, generated credentials, or placeholder proof.',
    '',
    'Verify:',
    ...verification.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n')
}
