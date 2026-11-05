import type { ProductContract } from './product-contract'
import { executionTransaction } from './execution-ownership'
import { canManageAudit, loadAuditAccessSource } from './access'
import { ensureProductProject, mutateProjectIntelligence } from './ensure-product-project'
import { mergeContractIntoProductIntelligence } from './product-intelligence'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'

/** Report context and Site memory are one owner action. Original authorship
 * never authorizes changing another owner's retained Site. */
export async function saveOwnedReportProductContract(auditId: string, userId: string, productContract: ProductContract) {
  return executionTransaction(async tx => {
    const initial = await loadAuditAccessSource(auditId, tx)
    if (!initial || !canManageAudit(initial, { id: userId }))
      throw new SiteRunRefusal('Sign in to edit the product contract', 403, 'REPORT_ACCESS_DENIED')
    // An unattached report resolves its target before taking the Audit lock,
    // retaining the shared User, Site, Audit order through attachment.
    const projectId = initial.projectId ?? (await ensureProductProject(userId, initial.url, tx)).id
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`
    const project = await tx.project.findFirst({ where: { id: projectId, userId, deletedAt: null }, select: { id: true } })
    if (!project) throw new SiteRunRefusal('Sign in to edit the product contract', 403, 'REPORT_ACCESS_DENIED')
    await tx.$queryRaw`SELECT id FROM audits WHERE id = ${auditId} FOR UPDATE`
    const source = await loadAuditAccessSource(auditId, tx)
    if (!source || source.projectId !== initial.projectId || !canManageAudit(source, { id: userId }))
      throw new SiteRunRefusal('Sign in to edit the product contract', 403, 'REPORT_ACCESS_DENIED')
    if (source.status !== 'COMPLETED') throw new SiteRunRefusal('Only completed reports can update the product contract', 400, 'REPORT_NOT_COMPLETED')
    const updated = await tx.audit.update({ where: { id: auditId, projectId: source.projectId, userId: source.userId },
      data: { productContract: productContract as object, projectId }, select: { id: true, productContract: true, projectId: true } })
    await mutateProjectIntelligence(projectId, current => mergeContractIntoProductIntelligence(current, productContract), tx)
    return updated
  }, { activeUserId: userId })
}
