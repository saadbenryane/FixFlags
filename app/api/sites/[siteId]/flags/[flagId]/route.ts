import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { loadSiteBoardFlag } from '@/lib/sites/application/queries'
import { loadSiteFlagVerification } from '@/lib/sites/application/flag-verification-state'
import { viewerRepairGuidance } from '@/lib/sites/viewer-projection'
import { flagVerificationStatusSchema, siteFlagPanelSchema } from '@/lib/sites/flag-panel'

export async function GET(request: Request, context: { params: Promise<{ siteId: string; flagId: string }> }) {
  try {
    const { siteId, flagId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const owner = access.decision.role === 'owner'
    const verificationAuditId = new URL(request.url).searchParams.get('verification')
    if (verificationAuditId !== null) {
      if (!owner || !verificationAuditId || verificationAuditId.length > 200) return apiError('Verification not found', 404)
      const verification = await loadSiteFlagVerification(access.decision.site, flagId, verificationAuditId)
      if (!verification) return apiError('Verification not found', 404)
      return NextResponse.json(flagVerificationStatusSchema.parse({ auditId: verification.auditId, verifying: verification.verifying }),
        { headers: { 'Cache-Control': 'private, no-store' } })
    }
    const detail = await loadSiteBoardFlag(access.decision.site.siteId, flagId, access.decision.site)
    if (!detail) return apiError('Flag not found', 404)
    const { flag, capture } = detail
    const payload = siteFlagPanelSchema.parse({ flag: {
      id: flag.id, sourceFlagId: flag.sourceFlagId ?? null, sourceAuditId: flag.sourceAuditId,
      checkId: flag.checkId,
      problem: flag.problem, evidence: flag.evidence, evidenceMissing: flag.evidenceMissing,
      whyItMatters: flag.whyItMatters, expectedBehavior: flag.expectedBehavior, ...viewerRepairGuidance(flag, owner), pageUrl: flag.pageUrl,
      affectedPaths: flag.affectedPaths, viewport: flag.viewport,
      supportingObservations: flag.supportingObservations ?? [], supportingEvidenceUnreadable: flag.supportingEvidenceUnreadable ?? false,
      performanceEvidenceSource: flag.performanceEvidenceSource ?? null,
      verifying: flag.verifying, status: flag.status,
      activeVerificationAuditId: owner ? flag.activeVerificationAuditId ?? null : null,
      verificationFeedback: owner ? flag.verificationFeedback ?? null : null,
    }, capture })
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return handleRouteError(error, 'Could not load Flag') }
}
