import { prisma } from '@/lib/db'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { syncOutcomesFromAudit } from '@/lib/sites/outcomes'

/** Runs before the durable finalization receipt; failure is retried by finalization recovery. */
export async function projectSiteAnalysis(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUniqueOrThrow({
    where: { id: auditId },
    select: { projectId: true, url: true },
  })
  const provisional = audit.projectId ? null : await prisma.provisionalSite.findFirst({
    where: { primaryAuditId: auditId },
    select: { id: true },
  })
  // Historical analyses without a customer Site have no Site projection to maintain.
  if (!audit.projectId && !provisional) return
  const site = await loadSiteRecord(audit.projectId ?? `p_${provisional!.id}`)
  if (!site) throw new Error('Site disappeared during analysis projection')
  await syncOutcomesFromAudit({ site, auditId, url: audit.url })
}
