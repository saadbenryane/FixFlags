import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'

export class RepoScanRequestError extends Error {
  readonly code: 'UPGRADE_REQUIRED' | 'NOT_CONNECTED' | 'REPO_NOT_ALLOWED'

  constructor(code: RepoScanRequestError['code'], message: string) {
    super(message)
    this.name = 'RepoScanRequestError'
    this.code = code
  }
}

export async function createAndEnqueueRepoScan(
  userId: string,
  repoFullName: string
): Promise<{ repoScanId: string }> {
  const connection = await prisma.githubConnection.findUnique({ where: { userId } })
  if (!connection || connection.revokedAt) {
    throw new RepoScanRequestError('NOT_CONNECTED', 'GitHub is not connected')
  }
  if (!connection.selectedRepos.includes(repoFullName)) {
    throw new RepoScanRequestError(
      'REPO_NOT_ALLOWED',
      `${repoFullName} is not in your allow-listed repositories`
    )
  }

  const scan = await prisma.repoScan.create({
    data: {
      userId,
      githubConnectionId: connection.id,
      repoFullName,
      status: 'QUEUED',
    },
    select: { id: true },
  })

  try {
    await getAuditQueue().add(
      'repo-scan',
      { repoScanId: scan.id },
      { jobId: scan.id, attempts: 1, removeOnComplete: 100, removeOnFail: 500 }
    )
  } catch (error) {
    await prisma.repoScan.update({
      where: { id: scan.id },
      data: { status: 'FAILED', errorMsg: 'Failed to enqueue repo scan job' },
    })
    throw error
  }

  return { repoScanId: scan.id }
}
