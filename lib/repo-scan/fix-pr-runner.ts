import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { prisma } from '@/lib/db'
import { decryptSecret } from '@/lib/security/crypto'
import { getGithubRepo } from '@/lib/integrations/github'
import { createBranchRef, createDraftPullRequest, GithubPermissionError } from '@/lib/integrations/github-pr'
import { logger } from '@/lib/logger'
import { cloneRepoShallow, pushBranch } from './clone'
import { isAutoPatchable, buildMechanicalPatch } from './mechanical-patch'
import { buildRepoFindingFixTask } from './finding-fix-task'
import { FIX_PR_TIMEOUT_MS } from './constants'

const execFileAsync = promisify(execFile)

export class RepoFixPrError extends Error {}

export async function runFixPr(repoFixPrId: string): Promise<void> {
  const fixPr = await prisma.repoFixPr.findUnique({
    where: { id: repoFixPrId },
    include: {
      finding: true,
      repoScan: { include: { githubConnection: true } },
    },
  })
  if (!fixPr) throw new RepoFixPrError(`RepoFixPr ${repoFixPrId} not found`)

  const { githubConnection, repoFullName } = fixPr.repoScan
  if (githubConnection.revokedAt) {
    await failFixPr(repoFixPrId, 'GitHub connection has been revoked')
    return
  }
  if (!githubConnection.selectedRepos.includes(repoFullName)) {
    await failFixPr(repoFixPrId, `${repoFullName} is not in the allow-listed repositories`)
    return
  }

  await prisma.repoFixPr.update({ where: { id: repoFixPrId }, data: { status: 'CREATING' } })

  const deadline = setTimeoutGuard(FIX_PR_TIMEOUT_MS, () => failFixPr(repoFixPrId, 'Fix PR creation timed out'))

  let cleanup: (() => Promise<void>) | null = null
  try {
    const accessToken = decryptSecret(githubConnection.encryptedAccessToken)
    const repo = await getGithubRepo(accessToken, repoFullName)

    // Guard against ever targeting the default branch, however unlikely given the
    // fixflags/ branch prefix - a PR is a proposal, but we never want to push directly
    // to the branch users actually ship from.
    if (fixPr.branchName === repo.default_branch) {
      throw new RepoFixPrError(
        `Refusing to use ${fixPr.branchName} as a fix branch - it matches the repository's default branch`
      )
    }

    const patchable = isAutoPatchable(fixPr.finding)
    let patchApplied = false

    if (patchable) {
      const cloned = await cloneRepoShallow(repoFullName, accessToken)
      cleanup = cloned.cleanup
      await execFileAsync('git', ['checkout', '-b', fixPr.branchName], { cwd: cloned.dir })

      const patch = await buildMechanicalPatch(fixPr.finding, cloned.dir)
      patchApplied = patch.changed
      if (patch.changed) {
        await execFileAsync('git', ['add', '-A'], { cwd: cloned.dir })
        await execFileAsync(
          'git',
          ['-c', 'user.email=bot@fixflags.com', '-c', 'user.name=FixFlags', 'commit', '-m', patch.description],
          { cwd: cloned.dir }
        )
      }

      await pushBranch(cloned.dir, fixPr.branchName, accessToken)
    } else {
      await createBranchRef(accessToken, repoFullName, fixPr.branchName, fixPr.baseSha)
    }

    const fixTask = buildRepoFindingFixTask({
      repoFullName,
      commitSha: fixPr.baseSha,
      severity: fixPr.finding.severity,
      category: fixPr.finding.category,
      filePath: fixPr.finding.filePath,
      lineStart: fixPr.finding.lineStart,
      lineEnd: fixPr.finding.lineEnd,
      problem: fixPr.finding.problem,
      evidence: fixPr.finding.evidence,
      fix: fixPr.finding.fix,
    })

    const pr = await createDraftPullRequest(accessToken, repoFullName, {
      title: fixTask.commitMessage,
      head: fixPr.branchName,
      base: repo.default_branch,
      body: fixTask.prompt,
    })

    await prisma.repoFixPr.update({
      where: { id: repoFixPrId },
      data: {
        status: 'CREATED',
        prNumber: pr.number,
        prUrl: pr.htmlUrl,
        patchApplied,
      },
    })
  } catch (err) {
    logger.error(`Fix PR ${repoFixPrId} failed`, err)
    const message =
      err instanceof GithubPermissionError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Fix PR creation failed'
    await failFixPr(repoFixPrId, message)
  } finally {
    clearTimeout(deadline)
    if (cleanup) await cleanup().catch(() => {})
  }
}

async function failFixPr(repoFixPrId: string, errorMsg: string): Promise<void> {
  await prisma.repoFixPr.updateMany({
    where: { id: repoFixPrId, status: { not: 'CREATED' } },
    data: { status: 'FAILED', errorMsg },
  })
}

function setTimeoutGuard(ms: number, onTimeout: () => void): NodeJS.Timeout {
  const timer = setTimeout(onTimeout, ms)
  timer.unref?.()
  return timer
}
