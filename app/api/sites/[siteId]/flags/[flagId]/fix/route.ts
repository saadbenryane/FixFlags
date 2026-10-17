import { hasRepairGuidance } from '@/lib/improvements/repair-guidance'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteBoardFlag } from '@/lib/sites/application/queries'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { EDITOR_EVIDENCE_COPY } from '@/lib/marketing/copy/verification-evidence'
import { boardFlagPrompt } from '@/lib/sites/board-card'

const schema = z.object({
  action: z.enum(['copy']),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string; flagId: string }> }
) {
  try {
    const { siteId, flagId } = await context.params
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const userId = access.decision.site.userId
    if (!userId) return apiError('Claim this Site first.', 403)
    const body = schema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) return apiError('Invalid action', 400)

    const detail = await loadSiteBoardFlag(access.decision.site.siteId, flagId)
    if (!detail) return apiError('Flag not found', 404)
    if (detail.flag.supportingEvidenceUnreadable) return apiError(EDITOR_EVIDENCE_COPY.unreadable, 422)
    if (!hasRepairGuidance(detail.flag.fix)) return apiError(SITE_ACTION_COPY.repairGuidance[detail.flag.repairGuidance === 'pending' ? 'pending' : 'unavailable'], 422)
    const prompt = boardFlagPrompt({
      problem: detail.flag.problem,
      whyItMatters: detail.flag.whyItMatters,
      evidence: detail.flag.evidenceMissing ? null : detail.flag.evidence,
      fix: detail.flag.fix,
      pageUrl: detail.flag.pageUrl,
      affectedPaths: detail.flag.affectedPaths,
      journeyName: detail.flag.relatedOutcome?.name,
      expectedBehavior: detail.flag.expectedBehavior,
      supportingObservations: detail.flag.supportingObservations,
    })

    if (!prompt) return apiError(EDITOR_EVIDENCE_COPY.unreadable, 422)
    const recorded = await executeSiteCommand({
      type: 'RECORD_FIX_HANDOFF',
      flagId: detail.flag.sourceFlagId ?? detail.flag.id,
      userId,
      builder: 'copy',
    })
    const handoff = 'handoff' in recorded ? recorded.handoff : null

    return NextResponse.json({ ok: true, prompt, handoff })
  } catch (error) {
    return handleRouteError(error)
  }
}
