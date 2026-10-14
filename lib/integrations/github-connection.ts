import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import { decryptSecret, encryptSecret } from '@/lib/security/crypto'
import { getAuditQueue } from '@/lib/queue/client'
import { logger } from '@/lib/logger'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { exchangeCodeForGithubToken, fetchGithubUser, revokeGithubGrant } from './github'

async function lockAccount(transaction: Prisma.TransactionClient, userId: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
  if (!rows.length) throw new SiteRunRefusal('Account not found', 404, 'ACCOUNT_NOT_FOUND')
}

/** Authorization and disconnect share an account lock, including provider calls. */
export async function saveGithubAuthorization(userId: string, code: string) {
  await prisma.$transaction(async transaction => {
    await lockAccount(transaction, userId)
    const user = await transaction.user.findUnique({ where: { id: userId } })
    if (!user || !canScanRepositories(user)) throw new SiteRunRefusal('GitHub connection access is unavailable for this account.', 403, 'ACCESS_NOT_ALLOWED')
    const { accessToken, scope } = await exchangeCodeForGithubToken(code)
    const githubUser = await fetchGithubUser(accessToken)
    const authorization = { githubUserId: String(githubUser.id), githubLogin: githubUser.login, encryptedAccessToken: encryptSecret(accessToken), scope }
    await transaction.githubConnection.upsert({ where: { userId },
      create: { userId, ...authorization, selectedRepos: [] },
      update: { ...authorization, revokedAt: null, connectedAt: new Date() },
    })
  }, { timeout: 30_000 })
}

export async function disconnectGithubAuthorization(userId: string): Promise<{ ok: true; revocation: 'confirmed' | 'unconfirmed' | 'not_needed' }> {
  return prisma.$transaction(async transaction => {
    await lockAccount(transaction, userId)
    const connection = await transaction.githubConnection.findUnique({ where: { userId } })
    if (!connection) return { ok: true, revocation: 'not_needed' }
    let revoked = false
    try { revoked = await revokeGithubGrant(decryptSecret(connection.encryptedAccessToken)) }
    catch (error) { logger.warn('GitHub external revocation could not be confirmed', { connectionId: connection.id, error: error instanceof Error ? error.name : 'unknown' }) }
    const pending = await transaction.repoFixPr.findMany({ where: { userId, status: { in: ['DRAFT', 'CREATING'] } }, select: { id: true } })
    await Promise.all(pending.map(async job => {
      try { await getAuditQueue().remove(job.id) }
      catch (error) { logger.warn('Failed to remove queued fix-PR job', { fixPrId: job.id, error: error instanceof Error ? error.name : 'unknown' }) }
    }))
    // The existing cascade removes repository scan and fix history. The UI
    // requires acknowledgement of that retention behavior before removal.
    await transaction.githubConnection.delete({ where: { id: connection.id } })
    return { ok: true, revocation: revoked ? 'confirmed' : 'unconfirmed' }
  }, { timeout: 30_000 })
}
