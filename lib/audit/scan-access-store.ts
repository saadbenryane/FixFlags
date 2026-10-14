import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { productTransaction } from '@/lib/billing/product-transaction'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { cancelSiteExecutions } from '@/lib/sites/application/cancel-executions'
import { decryptScanAccess, encryptScanAccess, type ScanAccessConfig } from './scan-access'
import { readProjectAccessGrant, writeProjectAccessGrant, sameScanAccessCredentials, ScanAccessUnavailable } from './scan-access-grants'
import type { ScanAccessIntent } from './scan-access-intent'

type Database = Pick<Prisma.TransactionClient, 'audit' | 'project'>
/** Every new admission seals its access decision, including an explicit public check. */
export async function admitScanAccess(db: Database, input: { projectId: string | null; userId: string | null; targetUrl: string;
  explicit?: ScanAccessConfig | null; useProject?: boolean; allowRemovedForCleanup?: boolean }) {
  const origin = new URL(input.targetUrl).origin
  if (input.explicit !== undefined) {
    if (input.explicit && !input.userId) throw new ScanAccessUnavailable()
    return { config: input.explicit, intent: { kind: input.explicit ? 'explicit' : 'public', origin } as ScanAccessIntent }
  }
  if (input.useProject === false || !input.projectId || !input.userId) return { config: null, intent: { kind: 'public', origin } as ScanAccessIntent }
  const project = await db.project.findFirst({ where: { id: input.projectId, userId: input.userId }, select: { id: true, url: true, userId: true, deletedAt: true, scanAccessEncrypted: true } })
  if (!project || project.userId !== input.userId || project.deletedAt && !input.allowRemovedForCleanup) throw new ScanAccessUnavailable()
  const grant = readProjectAccessGrant(project.scanAccessEncrypted, project.url)
  return { config: grant.config, intent: { kind: 'project', origin: grant.origin, projectId: project.id, reference: grant.reference } as ScanAccessIntent }
}

export async function resolveAuditScanAccess(auditId: string): Promise<ScanAccessConfig | null> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { url: true, userId: true, executionSpec: true,
    scanAccessEncrypted: true, projectId: true, project: { select: { id: true, url: true, userId: true, deletedAt: true, scanAccessEncrypted: true } } } })
  if (!audit) return null
  const config = decryptScanAccess(audit.scanAccessEncrypted)
  const spec = readExecutionSpec(audit.executionSpec), intent = spec?.scanAccess
  if (!spec && audit.executionSpec && typeof audit.executionSpec === 'object' && 'scanAccess' in audit.executionSpec) throw new ScanAccessUnavailable()
  const cleanup = spec?.scope === 'ACCOUNT_CHECKS' && spec.accountChecks?.mode === 'cleanup'
  if (intent?.kind === 'public') return null
  if (intent?.kind === 'explicit') {
    if (!config || !audit.userId || new URL(audit.url).origin !== new URL(intent.origin).origin || audit.project &&
      (audit.project.userId !== audit.userId || audit.project.deletedAt && !cleanup)) throw new ScanAccessUnavailable()
    return { ...config, origin: intent.origin }
  }
  if (!intent && !audit.scanAccessEncrypted) return null
  if (audit.scanAccessEncrypted && !config) throw new ScanAccessUnavailable()
  const project = audit.project
  if (!project || project.deletedAt && !cleanup || project.userId !== audit.userId) throw new ScanAccessUnavailable()
  const grant = readProjectAccessGrant(project.scanAccessEncrypted, project.url)
  if (intent?.kind === 'project') {
    if (intent.projectId !== project.id || intent.reference !== grant.reference ||
      !sameScanAccessCredentials(config, grant.config) || config && new URL(intent.origin).origin !== new URL(grant.origin).origin) throw new ScanAccessUnavailable()
    return config ? { ...config, origin: intent.origin } : null
  }
  // Unversioned secrets require an unchanged, currently authorized legacy Site grant.
  if (!grant.legacyCompatible || !config || !sameScanAccessCredentials(config, grant.config)) throw new ScanAccessUnavailable()
  return { ...config, origin: grant.origin }
}

export async function persistAuditScanAccess(auditId: string, config: ScanAccessConfig | null): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { url: true, executionSpec: true, userId: true } })
  const spec = readExecutionSpec(audit?.executionSpec)
  if (!audit || !spec || config && !audit.userId) throw new ScanAccessUnavailable()
  const changed = await prisma.audit.updateMany({ where: { id: auditId, status: 'QUEUED', startedAt: null }, data: {
    scanAccessEncrypted: config ? encryptScanAccess(config) : null,
    executionSpec: { ...spec, scanAccess: { kind: config ? 'explicit' : 'public', origin: new URL(audit.url).origin } } as Prisma.InputJsonValue,
    ...(config ? { isPublic: false } : {}),
  } })
  if (changed.count !== 1) throw new ScanAccessUnavailable()
}

export async function persistProjectScanAccess(projectId: string, userId: string, config: ScanAccessConfig | null): Promise<void> {
  await productTransaction(async tx => {
    const [project] = await tx.$queryRaw<Array<{ id: string; url: string; scanAccessEncrypted: string | null }>>`
      SELECT "id", "url", "scanAccessEncrypted" FROM "projects"
      WHERE "id" = ${projectId} AND "userId" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`
    if (!project) throw new Error('Project not found')
    let previous
    try { previous = readProjectAccessGrant(project.scanAccessEncrypted, project.url) }
    catch { /* A replacement or revocation cannot inherit an unreadable grant. */ }
    const saved = writeProjectAccessGrant(config, project.url, previous)
    await tx.project.update({ where: { id: project.id }, data: { scanAccessEncrypted: saved.payload } })
    if (!saved.changed) return
    const pending = await tx.audit.findMany({ where: { projectId, status: { notIn: ['COMPLETED', 'FAILED'] } }, select: { id: true, executionSpec: true } })
    const affected = pending.filter(audit => { const access = readExecutionSpec(audit.executionSpec)?.scanAccess; return !access || access.kind === 'project' }).map(audit => audit.id)
    if (affected.length) await cancelSiteExecutions(tx, projectId, new Date(), { code: 'SCAN_ACCESS_CHANGED',
      message: 'Website access changed. Start a new check to use the current settings.' }, { auditIds: affected, stage: 'scan-access' })
  })
}
