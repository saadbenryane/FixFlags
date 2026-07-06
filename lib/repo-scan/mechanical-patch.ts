import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isAutoPatchable, type AutoPatchableFinding } from './auto-patch-policy'

const execFileAsync = promisify(execFile)

export type MechanicalPatchInput = AutoPatchableFinding

export interface MechanicalPatchResult {
  changed: boolean
  description: string
}

export { isAutoPatchable }

/**
 * Stops a committed .env* file from being tracked going forward: appends it to .gitignore
 * (idempotent) and untracks it with `git rm --cached`. Never rewrites git history and never
 * attempts to rotate the credential itself - the PR body (existing `fix` text) tells the user
 * to rotate it, since it must be treated as compromised once pushed.
 */
export async function buildMechanicalPatch(
  finding: MechanicalPatchInput,
  repoDir: string
): Promise<MechanicalPatchResult> {
  if (!isAutoPatchable(finding)) {
    return { changed: false, description: 'No mechanical patch available for this finding.' }
  }

  const gitignorePath = join(repoDir, '.gitignore')
  const existing = await readFile(gitignorePath, 'utf8').catch(() => '')
  const alreadyIgnored = existing
    .split('\n')
    .map((line) => line.trim())
    .includes(finding.filePath)

  if (!alreadyIgnored) {
    const needsLeadingNewline = existing.length > 0 && !existing.endsWith('\n')
    await appendFile(gitignorePath, `${needsLeadingNewline ? '\n' : ''}${finding.filePath}\n`, 'utf8')
  }

  const wasTracked = await isTrackedByGit(finding.filePath, repoDir)
  if (wasTracked) {
    await execFileAsync('git', ['rm', '--cached', '--ignore-unmatch', finding.filePath], {
      cwd: repoDir,
    })
  }

  if (!alreadyIgnored && wasTracked) {
    return {
      changed: true,
      description: `Added ${finding.filePath} to .gitignore and stopped tracking it. Rotate the exposed credential - it must be treated as compromised.`,
    }
  }
  if (!alreadyIgnored) {
    return { changed: true, description: `Added ${finding.filePath} to .gitignore.` }
  }
  if (wasTracked) {
    return {
      changed: true,
      description: `Stopped tracking ${finding.filePath}. Rotate the exposed credential - it must be treated as compromised.`,
    }
  }
  return { changed: false, description: `${finding.filePath} is already ignored and untracked.` }
}

async function isTrackedByGit(filePath: string, repoDir: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['ls-files', '--error-unmatch', filePath], { cwd: repoDir })
    return true
  } catch {
    return false
  }
}
