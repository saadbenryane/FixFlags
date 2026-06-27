import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

const CLONE_TIMEOUT_MS = 60_000

/**
 * Shallow-clones a repo into a fresh temp directory. The token is handed to git via a
 * one-shot GIT_ASKPASS script that reads it from an environment variable, so it never
 * appears in argv (visible to `ps`) or in any file written to disk (.git/config, etc).
 */
export async function cloneRepoShallow(
  repoFullName: string,
  accessToken: string
): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const scriptDir = await mkdtemp(join(tmpdir(), 'repo-scan-askpass-'))
  const dir = await mkdtemp(join(tmpdir(), 'repo-scan-'))
  const askpassPath = join(scriptDir, 'askpass.sh')
  const cloneUrl = `https://x-access-token@github.com/${repoFullName}.git`

  try {
    await writeFile(askpassPath, '#!/bin/sh\necho "$REPO_SCAN_GIT_TOKEN"\n', 'utf8')
    await chmod(askpassPath, 0o700)

    await execFileAsync(
      'git',
      ['clone', '--depth', '1', '--single-branch', cloneUrl, dir],
      {
        timeout: CLONE_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_ASKPASS: askpassPath,
          GIT_TERMINAL_PROMPT: '0',
          REPO_SCAN_GIT_TOKEN: accessToken,
        },
      }
    )
  } catch (err) {
    await rm(dir, { recursive: true, force: true })
    throw err instanceof Error ? new Error(`Failed to clone ${repoFullName}: ${err.message}`) : err
  } finally {
    await rm(scriptDir, { recursive: true, force: true })
  }

  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}
