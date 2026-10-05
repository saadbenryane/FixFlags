import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { loadSiteOutcomeDetail, setSiteOutcomeEnabled } from '@/lib/sites/outcomes'
import { requireSiteAccess, requireSiteOwner } from '@/lib/sites/request-access'
import { requestOutcomeRun } from '@/lib/sites/application/run-requests'

const patchSchema = z.object({ enabled: z.boolean() }).strict()

export async function GET(_request: Request, context: { params: Promise<{ siteId: string; outcomeId: string }> }) {
  try {
    const { siteId, outcomeId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const outcome = await loadSiteOutcomeDetail(access.decision.site, outcomeId)
    if (!outcome) return apiError('Outcome not found', 404)
    return NextResponse.json({ outcome })
  } catch (error) {
    return handleRouteError(error, 'Could not load Outcome')
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ siteId: string; outcomeId: string }> }) {
  try {
    const { siteId, outcomeId } = await context.params
    const owner = await requireSiteOwner(siteId)
    if (!owner.ok) return apiError(owner.message, owner.status)
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Choose whether this Outcome is enabled.', 400)
    const before = await loadSiteOutcomeDetail(owner.decision.site, outcomeId)
    if (!before) return apiError('Outcome not found', 404)
    const outcome = await setSiteOutcomeEnabled({ site: owner.decision.site, outcomeId, enabled: parsed.data.enabled })
    if (!outcome) return apiError('Outcome not found', 404)
    let verificationQueued = false
    let verificationError: string | null = null
    if (parsed.data.enabled && !before.enabled && outcome.bindings.some((binding) => binding.required) && outcome.state !== 'CLEAR') {
      try {
        const started = await requestOutcomeRun({
          projectId: owner.projectId,
          outcomeId,
          userId: owner.decision.site.userId!,
          source: 'WEB',
          idempotencyKey: `outcome-enable:${outcomeId}:${Date.now()}`,
          context: { action: 'enable_outcome' },
        })
        verificationQueued = Boolean(started.runId)
      } catch {
        verificationError = 'The Outcome is enabled, but its fresh verification could not start. Use Verify to try again.'
      }
    }
    return NextResponse.json({ outcome, verificationQueued, verificationError })
  } catch (error) {
    return handleRouteError(error, 'Could not update Outcome')
  }
}
