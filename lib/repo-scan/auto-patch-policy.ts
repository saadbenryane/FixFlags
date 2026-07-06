const ENV_FILE_PATTERN = /(^|\/)\.env(\..+)?$/

export interface AutoPatchableFinding {
  category: string
  filePath: string
}

/**
 * Whether a finding is safe enough to auto-patch with a pure, deterministic file edit - no
 * LLM, no semantic risk. Everything else only ever gets a PR description + fix prompt for the
 * user's own agent to apply (see lib/repo-scan/finding-fix-task.ts). Client-safe (no node
 * built-ins) so both the UI and the server-side patcher (lib/repo-scan/mechanical-patch.ts)
 * can share this one predicate.
 */
export function isAutoPatchable(finding: AutoPatchableFinding): boolean {
  return finding.category === 'Exposed secret' && ENV_FILE_PATTERN.test(finding.filePath)
}
