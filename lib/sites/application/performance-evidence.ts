import { prisma } from '@/lib/db'
import { taskArtifactSchema } from '@/lib/audit/progressive/contracts'
import { performanceMeasurementSchema, type PerformanceMeasurement } from '@/lib/audit/performance-measurement'
import type { SiteRecord } from '../types'

/** Only a recorded collector on this exact Audit and page supplies conditions. */
export async function loadPerformanceEvidence(site: SiteRecord, auditId: string, pageUrl: string) {
  const rows = await prisma.auditVerifierExecution.findMany({ where: { auditId, pageUrl, workKind: 'pagespeed', workState: 'COMPLETED',
    audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' } },
    orderBy: { createdAt: 'asc' }, take: 2, select: { workResult: true } })
  return rows.flatMap<PerformanceMeasurement>(row => {
    const artifact = taskArtifactSchema.safeParse(row.workResult)
    if (!artifact.success || artifact.data.kind !== 'pagespeed') return []
    return ['desktop', 'mobile'].flatMap(device => {
      const value = artifact.data.data[device]
      const diagnostics = value && typeof value === 'object' && !Array.isArray(value) ? value.diagnostics : null
      const parsed = performanceMeasurementSchema.safeParse(diagnostics && typeof diagnostics === 'object' && !Array.isArray(diagnostics) ? diagnostics.measurement : null)
      return parsed.success && parsed.data.strategy === device ? [parsed.data] : []
    })
  })
}
