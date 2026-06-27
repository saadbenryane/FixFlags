import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { prisma } from '@/lib/db'
import { decryptSecret } from '@/lib/security/crypto'
import { getGithubRepo } from '@/lib/integrations/github'
import { runAllCodeChecks } from '@/lib/audit/code-checks'
import { logger } from '@/lib/logger'
import { cloneRepoShallow } from './clone'
import { walkScannableFiles } from './walk-files'
import { buildFindingPrompt } from './build-finding-prompt'
import { MAX_REPO_SIZE_KB, SCAN_TIMEOUT_MS } from './constants'

const execFileAsync = promisify(execFile)

export class RepoScanError extends Error {}

export async function runRepoScan(repoScanId: string): Promise<void> {
  const scan = await prisma.repoScan.findUnique({
    where: { id: repoScanId },
    include: { githubConnection: true },
  })
  if (!scan) throw new RepoScanError(`RepoScan ${repoScanId} not found`)

  const { githubConnection } = scan
  if (githubConnection.revokedAt) {
    await failScan(repoScanId, 'GitHub connection has been revoked')
    return
  }
  if (!githubConnection.selectedRepos.includes(scan.repoFullName)) {
    await failScan(repoScanId, `${scan.repoFullName} is not in the allow-listed repositories`)
    return
  }

  await prisma.repoScan.update({
    where: { id: repoScanId },
    data: { status: 'CLONING', startedAt: new Date() },
  })

  const deadline = setTimeoutGuard(SCAN_TIMEOUT_MS, () => failScan(repoScanId, 'Scan timed out'))

  let cleanup: (() => Promise<void>) | null = null
  try {
    const accessToken = decryptSecret(githubConnection.encryptedAccessToken)

    const repo = await getGithubRepo(accessToken, scan.repoFullName)
    if (repo.size > MAX_REPO_SIZE_KB) {
      throw new RepoScanError(
        `${scan.repoFullName} (${Math.round(repo.size / 1024)} MB) exceeds the ${Math.round(MAX_REPO_SIZE_KB / 1024)} MB scan limit`
      )
    }

    const cloned = await cloneRepoShallow(scan.repoFullName, accessToken)
    cleanup = cloned.cleanup

    const commitSha = await getHeadCommitSha(cloned.dir)

    await prisma.repoScan.updateMany({
      where: { id: repoScanId, status: { notIn: ['COMPLETED', 'FAILED'] } },
      data: { status: 'SCANNING', commitSha },
    })

    const files = await walkScannableFiles(cloned.dir)
    const findings = runAllCodeChecks(files)

    const stillRunning = await prisma.repoScan.findUnique({
      where: { id: repoScanId },
      select: { status: true },
    })
    if (stillRunning?.status === 'FAILED') return

    if (findings.length > 0) {
      await prisma.repoScanFinding.createMany({
        data: findings.map((finding) => {
          const prompt = buildFindingPrompt(scan.repoFullName, finding)
          return {
            repoScanId,
            severity: finding.severity,
            category: finding.category,
            filePath: finding.filePath,
            lineStart: finding.lineStart,
            lineEnd: finding.lineEnd,
            problem: finding.problem,
            evidence: finding.evidence,
            fix: finding.fix,
            agentPrompt: prompt,
            cursorPrompt: prompt,
            claudePrompt: prompt,
          }
        }),
      })
    }

    await prisma.repoScan.updateMany({
      where: { id: repoScanId, status: { notIn: ['COMPLETED', 'FAILED'] } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
  } catch (err) {
    logger.error(`Repo scan ${repoScanId} failed`, err)
    await failScan(repoScanId, err instanceof Error ? err.message : 'Repo scan failed')
  } finally {
    clearTimeout(deadline)
    if (cleanup) await cleanup().catch(() => {})
  }
}

async function failScan(repoScanId: string, errorMsg: string): Promise<void> {
  await prisma.repoScan.updateMany({
    where: { id: repoScanId, status: { notIn: ['COMPLETED', 'FAILED'] } },
    data: { status: 'FAILED', errorMsg, completedAt: new Date() },
  })
}

function setTimeoutGuard(ms: number, onTimeout: () => void): NodeJS.Timeout {
  const timer = setTimeout(onTimeout, ms)
  timer.unref?.()
  return timer
}

async function getHeadCommitSha(repoDir: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoDir })
    return stdout.trim()
  } catch {
    return undefined
  }
}
