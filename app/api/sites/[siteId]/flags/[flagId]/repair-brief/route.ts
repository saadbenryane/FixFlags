import { NextResponse } from 'next/server'
import { repairBriefSchema, repairContextHashSchema, repairObservationOffsetSchema } from '@/lib/sites/repair-brief-contract'
import { loadSiteRepairEvidence } from '@/lib/sites/application/repair-evidence'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { buildSiteRepairBrief } from '@/lib/sites/repair-brief'
import { getAppUrl } from '@/lib/get-app-url'
import { validateApiKey } from '@/lib/mcp/tools'
import { extractMcpCredential } from '@/lib/mcp/auth'
import { credentialAllows } from '@/lib/mcp/oauth'

/** Read-only private evidence. Possession of the URL never grants access. */
export async function GET(request: Request, context: { params: Promise<{ siteId: string; flagId: string }> }) {
  let response: Response
  try {
    response = await readBrief(request, context)
  } catch (error) {
    response = handleRouteError(error, 'Could not read repair context')
  }
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('Vary', 'Cookie, Authorization')
  return response
}

async function readBrief(request: Request, context: { params: Promise<{ siteId: string; flagId: string }> }) {
  const { siteId, flagId } = await context.params
  // An explicit credential must succeed on its own, never borrow browser access.
  const hasCredential = request.headers.has('authorization') || request.headers.has('x-api-key')
  let site
  if (hasCredential) {
    const credential = extractMcpCredential(request.headers)
    if (!credential.ok) return apiError(credential.message, 401, { code: credential.code })
    const access = await validateApiKey(credential.key)
    if (!access) return apiError('Provide a valid FixFlags developer key.', 401, { code: 'INVALID_API_KEY' })
    if (access.apiKey.audience) return apiError('Use this MCP access token through fixflags.get_flag.', 403, { code: 'INVALID_AUDIENCE' })
    if (!credentialAllows(access.apiKey, 'flags:read')) return apiError('This key needs Flag evidence access.', 403, { code: 'INSUFFICIENT_SCOPE' })
    site = await loadSiteRecord(siteId)
    if (!site?.projectId || site.userId !== access.user.id) return apiError('Site not found', 404)
  } else {
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    site = access.decision.site
  }
  const query = new URL(request.url).searchParams
  const expected = query.get('contextHash')
  const observationOffset = Number(query.get('observationOffset') ?? 0)
  if (expected !== null && !repairContextHashSchema.safeParse(expected).success) return apiError('Invalid context revision.', 400)
  if (!repairObservationOffsetSchema.safeParse(observationOffset).success || observationOffset > 0 && !expected)
    return apiError('Continuing observations requires a valid page and context revision.', 400)
  const flag = await loadSiteFlagDetail(site, flagId)
  if (!flag) return apiError('Flag not found', 404)
  const brief = buildSiteRepairBrief(site.siteId, flag, getAppUrl(), flagId, observationOffset, expected ?? undefined)
  const view = query.get('view')
  if (view !== null && view !== 'capture') return apiError('Invalid repair evidence view.', 400)
  if (view === 'capture' && !expected) return apiError('Reading a capture requires its repair context revision.', 400)
  if (query.get('includeEvidence') === 'true' || view === 'capture') {
    const attached = await loadSiteRepairEvidence(site, flag, `${brief.links.json}&view=capture`)
    if (view === 'capture') {
      if (!attached.image || attached.evidence.capture.state !== 'available')
        return apiError('This source capture is not available.', 404, { code: 'REPAIR_CAPTURE_UNAVAILABLE' })
      return new NextResponse(new Uint8Array(attached.image), { headers: { 'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff', 'ETag': `"${attached.evidence.capture.sha256}"` } })
    }
    return NextResponse.json(repairBriefSchema.parse({ ...brief, evidence: attached.evidence }))
  }
  return NextResponse.json(brief)
}
