import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { categoryAreaSchema } from '@/lib/sites/domain/execution-spec'
import { SITE_ASSESSMENT_COPY } from '@/lib/marketing/copy/site-assessment'

const requestSchema = z.object({
  outcomeIds: z.array(z.string().min(1)).max(20).default([]),
  scope: z.enum(['outcomes', 'site', 'category']).default('outcomes'),
  area: categoryAreaSchema.optional(),
  environment: z.string().min(1).max(80).default('production'),
}).strict().superRefine((value, context) => {
  if (value.scope === 'outcomes' && value.outcomeIds.length === 0) {
    context.addIssue({ code: 'custom', path: ['outcomeIds'], message: 'Select at least one Outcome.' })
  }
  if ((value.scope === 'site' || value.scope === 'category') && value.outcomeIds.length > 0) {
    context.addIssue({ code: 'custom', path: ['outcomeIds'], message: 'Site care does not select Outcomes.' })
  }
  if ((value.scope === 'category') !== Boolean(value.area)) context.addIssue({ code: 'custom', path: ['area'], message: 'Select one category.' })
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) return apiError(SITE_ASSESSMENT_COPY.signInToRun, 401)

    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    if (access.decision.role !== 'owner' || !access.decision.site.projectId) {
      return apiError(SITE_ASSESSMENT_COPY.claimToRun, 403)
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(SITE_ASSESSMENT_COPY.invalidSelection, 400)
    const idempotencyKey = request.headers.get('idempotency-key')?.trim()
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      return apiError('Send an Idempotency-Key between 8 and 160 characters.', 400)
    }

    const result = await requestSiteRun({
      projectId: access.decision.site.projectId,
      outcomeIds: parsed.data.outcomeIds,
      userId: session.user.id,
      source: 'WEB',
      scope: parsed.data.scope === 'site' ? 'SITE' : parsed.data.scope === 'category' ? 'CATEGORY' : 'OUTCOMES',
      categoryArea: parsed.data.area,
      environment: parsed.data.environment,
      idempotencyKey,
      context: { action: parsed.data.scope === 'site' ? 'run_site_care' : parsed.data.scope === 'category' ? 'run_category' : 'run_outcomes', area: parsed.data.area },
    })
    return NextResponse.json(result, { status: result.reused ? 200 : 202 })
  } catch (error) {
    return handleRouteError(error, 'Could not start this Site run')
  }
}
