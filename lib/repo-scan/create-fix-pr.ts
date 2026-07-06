import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { buildRepoFindingFixTask } from './finding-fix-task'

export class RepoFixPrRequestError extends Error {
  readonly code: 'UPGRADE_REQUIRED' | 'NOT_CONNECTED' | 'REPO_NOT_ALLOWED' | 'SCAN_NOT_READY' | 'ALREADY_EXISTS'

  constructor(code: RepoFixPrRequestError['code'], message: string) {
    super(message)
    this.name = 'RepoFixPrRequestError'
    this.code = code
  }
}

export async function createAndEnqueueFixPr(
  userId: string,
  repoScanId: string,
  findingId: string
): Promise<{ repoFixPrId: string }> {
  const finding = await prisma.repoScanFinding.findUnique({
    where: { id: findingId },
    include: { repoScan: { include: { githubConnection: true } }, fixPr: true },
  })
  if (!finding || finding.repoScanId !== repoScanId || finding.repoScan.userId !== userId) {
    throw new RepoFixPrRequestError('SCAN_NOT_READY', 'Finding not found')
  }
  if (finding.fixPr) {
    throw new RepoFixPrRequestError('ALREADY_EXISTS', 'A fix PR already exists for this finding')
  }
  if (finding.repoScan.status !== 'COMPLETED' || !finding.repoScan.commitSha) {
    throw new RepoFixPrRequestError('SCAN_NOT_READY', 'The repo scan has not finished yet')
  }

  const { githubConnection } = finding.repoScan
  if (!githubConnection || githubConnection.revokedAt) {
    throw new RepoFixPrRequestError('NOT_CONNECTED', 'GitHub is not connected')
  }
  if (!githubConnection.selectedRepos.includes(finding.repoScan.repoFullName)) {
    throw new RepoFixPrRequestError(
      'REPO_NOT_ALLOWED',
      `${finding.repoScan.repoFullName} is not in your allow-listed repositories`
    )
  }

  const { branchName } = buildRepoFindingFixTask({
    repoFullName: finding.repoScan.repoFullName,
    commitSha: finding.repoScan.commitSha,
    severity: finding.severity,
    category: finding.category,
    filePath: finding.filePath,
    lineStart: finding.lineStart,
    lineEnd: finding.lineEnd,
    problem: finding.problem,
    evidence: finding.evidence,
    fix: finding.fix,
  })

  const fixPr = await prisma.repoFixPr.create({
    data: {
      repoScanId,
      findingId,
      userId,
      branchName,
      baseSha: finding.repoScan.commitSha,
      status: 'DRAFT',
    },
    select: { id: true },
  })

  try {
    await getAuditQueue().add(
      'repo-fix-pr',
      { repoFixPrId: fixPr.id },
      { jobId: fixPr.id, attempts: 1, removeOnComplete: 100, removeOnFail: 500 }
    )
  } catch (error) {
    await prisma.repoFixPr.update({
      where: { id: fixPr.id },
      data: { status: 'FAILED', errorMsg: 'Failed to enqueue fix PR job' },
    })
    throw error
  }

  return { repoFixPrId: fixPr.id }
}
