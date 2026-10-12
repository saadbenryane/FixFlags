import { testIdentity } from './identity'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { encryptSecret } from '@/lib/security/crypto'
import { executionTransaction } from '@/lib/audit/execution-ownership'
import { accountChecksEntitled, accountInfrastructureReady, accountCleanupReady, type AccountIntent, type AccountChecksView } from './contracts'

export async function accountAdmission(projectId: string, mode: AccountIntent['mode'] = 'routine') {
  const ready = mode === 'cleanup' ? accountCleanupReady() : accountInfrastructureReady()
  if (!ready) return undefined
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null },
    select: { url: true, accountChecksEnabled: true, accountCheckRevision: true, user: { select: { role: true, plan: true, subscriptionStatus: true } } } })
  return project && project.user && (mode === 'cleanup' || project.accountChecksEnabled && accountChecksEntitled(project.user))
    ? { revision: project.accountCheckRevision, mode, siteUrl: project.url } : undefined
}
export async function assertAccountPermission(projectId: string, intent: AccountIntent, db: Prisma.TransactionClient = prisma) {
  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null, accountCheckRevision: intent.revision,
    ...(intent.mode === 'cleanup' ? {} : { accountChecksEnabled: true }) },
    select: { user: { select: { role: true, plan: true, subscriptionStatus: true } } } })
  if (!project?.user || (intent.mode === 'cleanup' ? !accountCleanupReady()
    : !accountChecksEntitled(project.user) || !accountInfrastructureReady())) throw new Error('Account checks are paused or unavailable.')
}

export async function reserveAccount(input: { projectId: string; origin: string; purpose: 'retained' | 'disposable';
  signupUrl: string; loginUrl: string | null; fingerprint: string; intent: AccountIntent; replaceDeleted?: boolean }) {
  if (input.intent.mode === 'cleanup') throw new Error('Account cleanup cannot reserve a new identity.')
  return executionTransaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id" = ${input.projectId} FOR UPDATE`
    await assertAccountPermission(input.projectId, input.intent, tx)
    const where = { projectId_origin_purpose: { projectId: input.projectId, origin: input.origin, purpose: input.purpose } }
    const existing = await tx.siteTestAccount.findUnique({ where })
    if (existing && !(existing.state === 'DELETED' && input.replaceDeleted && input.purpose === 'disposable')) return existing
    const id = randomUUID(), identity = testIdentity(process.env.ACCOUNT_TEST_EMAIL!, id)
    const data = { email: identity.email, encryptedPassword: encryptSecret(identity.password), encryptedSession: null,
      signupUrl: input.signupUrl, loginUrl: input.loginUrl, homeUrl: null, flowFingerprint: input.fingerprint,
      state: 'RESERVED', operationId: null, submittedAt: null, signupVerifiedAt: null, deletionVerifiedAt: null }
    if (existing) {
      await tx.siteAccountMessage.deleteMany({ where: { accountId: existing.id } })
      return tx.siteTestAccount.update({ where: { id: existing.id }, data })
    }
    return tx.siteTestAccount.create({ data: { id, projectId: input.projectId, origin: input.origin, purpose: input.purpose, ...data } })
  })
}

/** Redacted projection is loaded only for the owning account. */
export async function loadAccountChecksView(projectId: string): Promise<AccountChecksView> {
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: {
    accountChecksEnabled: true, user: { select: { role: true, plan: true, subscriptionStatus: true } },
    testAccounts: { select: { purpose: true, email: true, state: true }, take: 2 },
    accountCheckReceipts: { orderBy: { createdAt: 'desc' }, take: 100,
      select: { kind: true, state: true, detail: true, pageUrl: true, evidence: true, createdAt: true } },
  } })
  const eligible = accountChecksEntitled(project?.user ?? null), ready = accountInfrastructureReady()
  const seen = new Set<string>()
  const { accountObservationSchema } = await import('./contracts')
  return { enabled: project?.accountChecksEnabled ?? false, eligible, ready,
    reason: !eligible ? 'Account checks are available on paid plans and during open beta.' : !ready ? 'Automatic account checks are not available yet.' : null,
    accounts: project?.testAccounts ?? [], results: (project?.accountCheckReceipts ?? []).flatMap(row => {
      const key = row.kind + ':' + row.pageUrl
      if (seen.has(key)) return []; seen.add(key)
      // Parse only the public-safe observation, not timestamps or persistence fields.
      const observation = accountObservationSchema.safeParse({ kind: row.kind, state: row.state, detail: row.detail, pageUrl: row.pageUrl, evidence: row.evidence })
      return observation.success ? [{ ...observation.data, checkedAt: row.createdAt.toISOString() }] : []
    }) }
}
