import { NextResponse } from 'next/server'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import { resolveLatestAudit } from '@/lib/sites/application/site-execution'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { z } from 'zod'
import { SITE_CARD_AREAS } from '@/lib/sites/card-areas'
import { RESULT_SELECTION_CHANGED } from '@/lib/sites/check-results'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

const querySchema = z.object({ area: z.enum(SITE_CARD_AREAS).optional(), pageUrl: z.string().max(4096).url()
  .refine(value => { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password }).optional() })

export async function GET(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const params = new URL(request.url).searchParams
    const filter = querySchema.safeParse({ area: params.get('area') ?? undefined, pageUrl: params.get('pageUrl') ?? undefined })
    if (!filter.success) return apiError('Choose a valid result scope.', 400)
    const cursor = params.get('cursor') ?? undefined
    if (cursor && !/^[a-zA-Z0-9_-]{1,1024}$/.test(cursor)) return apiError('Invalid check history cursor', 400)
    const site = access.decision.site
    const latest = await resolveLatestAudit(site)
    const page = await loadSiteCheckResultPage(site, latest, cursor, undefined, filter.data, true)
    return NextResponse.json(page, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid check history cursor') return apiError(error.message, 400, { code: RESULT_SELECTION_CHANGED })
    if (error instanceof Error && error.message === 'Check evidence selection changed')
      return apiError(SITE_ACTION_COPY.resultsUpdated, 409, { code: RESULT_SELECTION_CHANGED })
    return handleRouteError(error, 'Could not load check results')
  }
}
