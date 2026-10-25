import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { loadSiteBoardFlag } from '@/lib/sites/application/queries'
import { viewerRepairGuidance } from '@/lib/sites/viewer-projection'
import { siteFlagPanelSchema } from '@/lib/sites/flag-panel'

export async function GET(_request: Request, context: { params: Promise<{ siteId: string; flagId: string }> }) {
  try {
    const { siteId, flagId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const detail = await loadSiteBoardFlag(access.decision.site.siteId, flagId)
    if (!detail) return apiError('Flag not found', 404)
    const { flag, capture } = detail
    const owner = access.decision.role === 'owner'
    const payload = siteFlagPanelSchema.parse({ flag: {
      id: flag.id, sourceFlagId: flag.sourceFlagId ?? null, sourceAuditId: flag.sourceAuditId,
      problem: flag.problem, evidence: flag.evidence, evidenceMissing: flag.evidenceMissing,
      whyItMatters: flag.whyItMatters, expectedBehavior: flag.expectedBehavior, ...viewerRepairGuidance(flag, owner), pageUrl: flag.pageUrl,
      affectedPaths: flag.affectedPaths, viewport: flag.viewport,
      supportingObservations: flag.supportingObservations ?? [], supportingEvidenceUnreadable: flag.supportingEvidenceUnreadable ?? false,
      performanceEvidenceSource: flag.performanceEvidenceSource ?? null,
      verifying: flag.verifying, status: flag.status,
    }, capture })
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return handleRouteError(error, 'Could not load Flag') }
}
