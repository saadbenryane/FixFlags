import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revokeGithubGrant } from '@/lib/integrations/github'
import { decryptSecret } from '@/lib/security/crypto'
import { getAuditQueue } from '@/lib/queue/client'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const connection = await prisma.githubConnection.findUnique({
      where: { userId: session.user.id },
    })
    if (!connection) return NextResponse.json({ ok: true })

    try {
      const accessToken = decryptSecret(connection.encryptedAccessToken)
      await revokeGithubGrant(accessToken)
    } catch {
      // Token may already be invalid/undecryptable - still remove our local record below.
    }

    // Best-effort: drop any queued/in-flight fix-PR jobs before the cascade delete below
    // removes their DB rows, so the worker doesn't spend a cycle on a connection that's
    // about to be gone. Not required for correctness - runFixPr already fails cleanly
    // (no-op update) if its RepoFixPr row is gone by the time the job runs.
    const pendingFixPrs = await prisma.repoFixPr.findMany({
      where: { userId: session.user.id, status: { in: ['DRAFT', 'CREATING'] } },
      select: { id: true },
    })
    await Promise.all(
      pendingFixPrs.map((fixPr) => getAuditQueue().remove(fixPr.id).catch(() => {}))
    )

    // Cascades to repo_scans -> repo_scan_findings -> repo_fix_prs (existing data-retention
    // policy: scan/PR history does not survive a GitHub disconnect).
    await prisma.githubConnection.delete({ where: { userId: session.user.id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'Failed to disconnect GitHub')
  }
}
