import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { CONFIRMABLE_OUTCOME_KINDS } from '@/lib/sites/outcome-kinds'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'

const schema = z.union([
  z.object({ watchPage: z.literal(true) }),
  z.object({
    action: z.literal('rename'),
    outcomeId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
  }),
  z.object({
    outcomeId: z.string().min(1),
    confirmed: z.boolean(),
    name: z.string().max(120).optional(),
    kind: z.enum(CONFIRMABLE_OUTCOME_KINDS).optional(),
  }),
])

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)

    const body = schema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) return apiError('Invalid outcome update', 400)

    const result = await executeSiteCommand(
      'watchPage' in body.data
        ? { type: 'CONFIRM_PAGE_AVAILABILITY', siteId: access.decision.site.siteId }
        : 'action' in body.data
          ? {
              type: 'RENAME_OUTCOME',
              siteId: access.decision.site.siteId,
              outcomeId: body.data.outcomeId,
              name: body.data.name,
            }
        : {
            type: 'CONFIRM_OUTCOME',
            siteId: access.decision.site.siteId,
            outcomeId: body.data.outcomeId,
            confirmed: body.data.confirmed,
            name: body.data.name,
            kind: body.data.kind,
          },
    )
    if (!result.ok) {
      // A refused confirmation is a client mistake, not a missing Outcome, and
      // the customer needs the reason rather than "not found".
      if (
        result.code === 'OUTCOME_KIND_REQUIRED'
        || result.code === 'OUTCOME_KIND_UNWATCHABLE'
        || result.code === 'OUTCOME_KIND_MISMATCH'
      ) {
        return apiError(result.error, 400, { code: result.code })
      }
      return apiError(result.error, 404)
    }
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
