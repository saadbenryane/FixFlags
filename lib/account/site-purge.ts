import { createHash } from 'node:crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import { removeSite } from '@/lib/sites/application/settings-commands'

type DB = PrismaClient | Prisma.TransactionClient
export type PurgeScope = { email: string; keepHost: string; removeHosts: string[]; unlinkedHosts: string[] }
export type PurgeManifest = {
  version: 1; createdAt: string; scope: PurgeScope; ownerId: string; keepProjectId: string;
  projectIds: string[]; auditIds: string[]; keptAuditIds: string[];
  dependencies: Record<string, number>; capturePrefixes: string[]; digest: string;
}
export type PurgeProgress = { digest: string; fenced: boolean; assetsDeleted: string[]; auditsDeleted: string[]; complete: boolean }
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"'
const sorted = (values: string[]) => [...values].sort()
const same = (a: string[], b: string[]) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))
export function manifestDigest(manifest: Omit<PurgeManifest, 'digest'> | PurgeManifest) {
  const material: Partial<PurgeManifest> = { ...manifest }
  delete material.digest
  return createHash('sha256').update(JSON.stringify(material)).digest('hex')
}

async function inspect(db: DB, scope: PurgeScope) {
  if (!scope.email || !scope.keepHost || !scope.removeHosts.length ||
      new Set(scope.removeHosts).size !== scope.removeHosts.length ||
      [...scope.removeHosts, ...scope.unlinkedHosts].includes(scope.keepHost)) throw new Error('Invalid purge scope')
  const owner = await db.user.findUniqueOrThrow({ where: { email: scope.email }, select: { id: true } })
  const projects = await db.project.findMany({ where: { userId: owner.id }, select: { id: true, canonicalHost: true, deletedAt: true } })
  const keep = projects.find(p => p.canonicalHost === scope.keepHost && !p.deletedAt)
  if (!keep) throw new Error('The retained website must exist and remain active')
  const targets = projects.filter(p => scope.removeHosts.includes(p.canonicalHost))
  // A changed inventory must get a new preview. Never infer new deletion targets.
  if (!same(projects.filter(p => p.id !== keep.id).map(p => p.canonicalHost), scope.removeHosts))
    throw new Error('Website inventory differs from the explicit removal scope')
  const projectIds = sorted(targets.map(p => p.id))
  const foreign = await db.audit.count({ where: { projectId: { in: projectIds }, userId: { not: owner.id } } })
  if (foreign) throw new Error('A target website contains another owner’s reports')
  const accounts = await db.siteTestAccount.count({ where: { projectId: { in: projectIds }, state: { not: 'DELETED' } } })
  if (accounts) throw new Error('External test-account cleanup must finish before purging')
  const audits = await db.audit.findMany({ where: { userId: owner.id, OR: [
    { projectId: { in: projectIds } }, { projectId: null, normalizedDomain: { in: scope.unlinkedHosts } },
  ] }, select: { id: true } })
  const kept = await db.audit.findMany({ where: { userId: owner.id, OR: [
    { projectId: keep.id }, { projectId: null, normalizedDomain: scope.keepHost },
  ] }, select: { id: true } })
  return { ownerId: owner.id, keepProjectId: keep.id, projectIds, auditIds: sorted(audits.map(a => a.id)), keptAuditIds: sorted(kept.map(a => a.id)) }
}

type Relation = { tableName: string; columnName: string; root: string; deleteAction: string }
async function relations(db: DB) {
  return db.$queryRawUnsafe<Relation[]>(`SELECT cl.relname AS "tableName", a.attname AS "columnName",
    p.relname AS root, c.confdeltype AS "deleteAction" FROM pg_constraint c
    JOIN pg_class cl ON cl.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace
    JOIN pg_class p ON p.oid=c.confrelid
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND ns.nspname='public' AND array_length(c.conkey,1)=1
      AND p.relname IN ('audits','projects') ORDER BY p.relname,cl.relname,a.attname`)
}

async function inspectDependencies(db: DB, inventory: Awaited<ReturnType<typeof inspect>>) {
  const counts: Record<string, number> = {}
  for (const relation of await relations(db)) {
    const ids = relation.root === 'audits' ? inventory.auditIds : inventory.projectIds
    const table = quote(relation.tableName), column = quote(relation.columnName)
    const [count] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*) FROM ${table} WHERE ${column}=ANY($1::text[])`, ids)
    counts[relation.tableName + '.' + relation.columnName] = Number(count.count)
    if (relation.deleteAction !== 'c') continue
    const columns = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name IN ('userId','projectId')`, relation.tableName)
    for (const { column_name: field } of columns) {
      if (field === relation.columnName) continue
      const allowed = field === 'userId' ? [inventory.ownerId] : inventory.projectIds
      const [outside] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*) FROM ${table} WHERE ${column}=ANY($1::text[]) AND ${quote(field)} IS NOT NULL AND NOT (${quote(field)}=ANY($2::text[]))`, ids, allowed)
      if (outside.count) throw new Error('Deletion would cascade into a retained owner or website: ' + relation.tableName)
    }
  }
  return counts
}

export async function previewSitePurge(db: PrismaClient, scope: PurgeScope): Promise<PurgeManifest> {
  return db.$transaction(async tx => {
    const inventory = await inspect(tx, scope)
    const material = { version: 1 as const, createdAt: new Date().toISOString(), scope, ...inventory,
      dependencies: await inspectDependencies(tx, inventory), capturePrefixes: inventory.auditIds.map(id => `screenshots/${id}/`) }
    return { ...material, digest: manifestDigest(material) }
  }, { isolationLevel: 'RepeatableRead', timeout: 60_000 })
}

export async function applySitePurge(db: PrismaClient, manifest: PurgeManifest, progress: PurgeProgress,
  deleteAssets: (auditIds: string[]) => Promise<void>, save: (progress: PurgeProgress) => Promise<void>) {
  if (manifest.version !== 1 || manifestDigest(manifest) !== manifest.digest || progress.digest !== manifest.digest)
    throw new Error('The purge manifest or progress identity is invalid')
  if (progress.assetsDeleted.some(id => !manifest.auditIds.includes(id)) || progress.auditsDeleted.some(id => !manifest.auditIds.includes(id)))
    throw new Error('Progress contains an unapproved report')
  // Lock inventory while admission is fenced. This does not change the User lifecycle.
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id=${manifest.ownerId} FOR UPDATE`
    await tx.$queryRawUnsafe(`SELECT id FROM projects WHERE "userId"=$1 ORDER BY id FOR UPDATE`, manifest.ownerId)
    const current = await inspect(tx, manifest.scope)
    if (current.ownerId !== manifest.ownerId || current.keepProjectId !== manifest.keepProjectId || !same(current.projectIds, manifest.projectIds))
      throw new Error('Owner or website scope changed after preview')
    if (current.auditIds.some(id => !manifest.auditIds.includes(id)) ||
        (!progress.fenced && !same(current.auditIds, manifest.auditIds)) ||
        !manifest.keptAuditIds.every(id => current.keptAuditIds.includes(id))) throw new Error('Report scope changed after preview')
    await inspectDependencies(tx, current)
    for (const id of manifest.projectIds) {
      const site = await tx.project.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })
      if (!site.deletedAt) await removeSite({ userId: manifest.ownerId, projectId: id }, {}, tx)
    }
    // Also fence unlinked historical reports and post-completion deliveries.
    await tx.audit.updateMany({ where: { id: { in: manifest.auditIds }, userId: manifest.ownerId }, data: {
      isPublic: false, status: 'FAILED', failureCode: 'OPERATOR_ERASURE', completedAt: new Date(),
      executionToken: null, executionLeaseUntil: null, executionGeneration: { increment: 1 },
    } })
    await tx.auditExecutionTask.updateMany({ where: { auditId: { in: manifest.auditIds }, workState: { in: ['WAITING', 'READY', 'RUNNING', 'RETRY_WAIT'] } },
      data: { workState: 'BLOCKED', status: 'FAILED', workToken: null, workLeaseUntil: null, workGeneration: { increment: 1 }, workRetryAt: null, workErrorCode: 'OPERATOR_ERASURE' } })
    await tx.shareLink.updateMany({ where: { auditId: { in: manifest.auditIds } }, data: { revoked: true, version: { increment: 1 } } })
    await tx.uptimeMonitor.updateMany({ where: { projectId: { in: manifest.projectIds } }, data: { enabled: false, leaseToken: null, leaseUntil: null } })
  }, { timeout: 120_000 })
  progress.fenced = true; await save(progress)
  // Assets precede report deletion so failed storage deletion remains retryable.
  for (const id of manifest.auditIds) {
    if (progress.assetsDeleted.includes(id)) continue
    await deleteAssets([id]); progress.assetsDeleted.push(id); await save(progress)
  }
  for (const id of manifest.auditIds) {
    if (progress.auditsDeleted.includes(id)) continue
    await db.$transaction(async tx => {
      await tx.audit.deleteMany({ where: { id, userId: manifest.ownerId } })
    }, { timeout: 60_000 })
    progress.auditsDeleted.push(id); await save(progress)
  }
  await db.$transaction(async tx => {
    const left = await tx.audit.count({ where: { projectId: { in: manifest.projectIds } } })
    if (left) throw new Error('Reports remain on a target website')
    await tx.project.deleteMany({ where: { id: { in: manifest.projectIds }, userId: manifest.ownerId, deletedAt: { not: null } } })
  }, { timeout: 60_000 })
  progress.complete = true; await save(progress)
}
