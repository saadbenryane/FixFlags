export type RepoFindingPromptTool =
  | 'generic'
  | 'cursor'
  | 'claude'
  | 'windsurf'
  | 'lovable'
  | 'bolt'

export interface RepoFindingFixTaskInput {
  repoFullName: string
  commitSha: string | null
  severity: string
  category: string
  filePath: string
  lineStart: number | null
  lineEnd: number | null
  problem: string
  evidence: string
  fix: string
}

export interface RepoFindingPayloadInput extends RepoFindingFixTaskInput {
  id: string
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  windsurfPrompt?: string | null
}

export interface RepoFindingFixTask {
  location: string
  branchName: string
  commitMessage: string
  prompt: string
  verification: string[]
}

export interface RepoFindingPayload extends RepoFindingFixTaskInput, RepoFindingFixTask {
  id: string
}

export function repoFindingLocation(finding: {
  filePath: string
  lineStart: number | null
  lineEnd: number | null
}): string {
  if (finding.lineStart && finding.lineEnd && finding.lineEnd !== finding.lineStart) {
    return `${finding.filePath}:${finding.lineStart}-${finding.lineEnd}`
  }
  if (finding.lineStart) return `${finding.filePath}:${finding.lineStart}`
  return finding.filePath
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function branchSlug(finding: RepoFindingFixTaskInput): string {
  const filePart = slugify(finding.filePath.split('/').pop() ?? finding.filePath)
  const problemPart = slugify(finding.problem)
  return [filePart, problemPart].filter(Boolean).join('-').slice(0, 56) || 'repo-finding'
}

function buildVerification(finding: RepoFindingFixTaskInput): string[] {
  const checks = [
    `Inspect ${repoFindingLocation(finding)} and confirm the flagged issue is gone.`,
    'Run the narrowest relevant unit, lint, or typecheck command for the touched file.',
    'Confirm no unrelated files or behavior changed.',
  ]

  if (/secret|token|key|credential/i.test(`${finding.category} ${finding.problem}`)) {
    checks.splice(1, 0, 'Rotate any exposed credential if it may have been committed or deployed.')
  }

  return checks
}

function buildBranchReadyPrompt(
  finding: RepoFindingFixTaskInput,
  branchName: string,
  commitMessage: string,
  verification: string[],
  tool: RepoFindingPromptTool
): string {
  return [
    `Fix this repository finding in ${finding.repoFullName}.`,
    '',
    `Base commit: ${finding.commitSha ?? 'unknown'}`,
    `Suggested branch: ${branchName}`,
    `Suggested commit: ${commitMessage}`,
    `File: ${repoFindingLocation(finding)}`,
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
    '',
    `Tool target: ${tool}`,
  ].join('\n')
}

export function buildRepoFindingFixTask(
  finding: RepoFindingFixTaskInput,
  tool: RepoFindingPromptTool = 'generic'
): RepoFindingFixTask {
  const branchName = `fixflags/${branchSlug(finding)}`
  const commitMessage = `Fix ${finding.category.toLowerCase()} finding in ${finding.filePath}`
  const verification = buildVerification(finding)
  const prompt = buildBranchReadyPrompt(finding, branchName, commitMessage, verification, tool)

  return {
    location: repoFindingLocation(finding),
    branchName,
    commitMessage,
    prompt,
    verification,
  }
}

export function buildRepoFindingPayload(
  finding: RepoFindingPayloadInput,
  tool: RepoFindingPromptTool = 'generic'
): RepoFindingPayload {
  return {
    id: finding.id,
    repoFullName: finding.repoFullName,
    commitSha: finding.commitSha,
    severity: finding.severity,
    category: finding.category,
    filePath: finding.filePath,
    lineStart: finding.lineStart,
    lineEnd: finding.lineEnd,
    problem: finding.problem,
    evidence: finding.evidence,
    fix: finding.fix,
    ...buildRepoFindingFixTask(finding, tool),
  }
}
