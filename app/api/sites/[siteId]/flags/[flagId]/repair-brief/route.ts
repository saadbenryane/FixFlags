import { requireRepairReader } from '@/lib/sites/repair-reader-access'
import { NextResponse } from 'next/server'
import { repairBriefSchema, repairContextHashSchema, repairObservationOffsetSchema, repairDocumentOffsetSchema } from '@/lib/sites/repair-brief-contract'
import { deliverSiteRepairBrief } from '@/lib/sites/repair-delivery'
import { loadSiteRepairEvidence } from '@/lib/sites/application/repair-evidence'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { loadSiteRepairBriefPage } from '@/lib/sites/flags'
import { getAppUrl } from '@/lib/get-app-url'

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
  const access = await requireRepairReader(request, siteId)
  if (!access.ok) return access.response
  const site = access.site
  const query = new URL(request.url).searchParams
  const expected = query.get('contextHash')
  const observationOffset = Number(query.get('observationOffset') ?? 0)
  const documentOffset = Number(query.get('documentOffset') ?? 0)
  const expectedDocumentHash = query.get('documentHash')
  if (expected !== null && !repairContextHashSchema.safeParse(expected).success) return apiError('Invalid context revision.', 400)
  if (!repairObservationOffsetSchema.safeParse(observationOffset).success || observationOffset > 0 && !expected)
    return apiError('Continuing observations requires a valid page and context revision.', 400)
  if (!repairDocumentOffsetSchema.safeParse(documentOffset).success ||
    expectedDocumentHash !== null && !repairContextHashSchema.safeParse(expectedDocumentHash).success ||
    documentOffset > 0 && (!expected || !expectedDocumentHash))
    return apiError('Continuing a repair document requires a valid offset and both revisions.', 400)
  let brief = await loadSiteRepairBriefPage(site, flagId, getAppUrl(), observationOffset, expected ?? undefined)
  if (!brief) return apiError('Flag not found', 404)
  const view = query.get('view')
  if (view !== null && view !== 'capture') return apiError('Invalid repair evidence view.', 400)
  if (view === 'capture' && !expected) return apiError('Reading a capture requires its repair context revision.', 400)
  if (query.get('includeEvidence') === 'true' || view === 'capture') {
    const attached = await loadSiteRepairEvidence(site, brief.flag, `${brief.links.json}&view=capture`)
    if (view === 'capture') {
      if (!attached.image || attached.evidence.capture.state !== 'available')
        return apiError('This source capture is not available.', 404, { code: 'REPAIR_CAPTURE_UNAVAILABLE' })
      return new NextResponse(new Uint8Array(attached.image), { headers: { 'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff', 'ETag': `"${attached.evidence.capture.sha256}"` } })
    }
    brief = repairBriefSchema.parse({ ...brief, evidence: attached.evidence })
  }
  return NextResponse.json(deliverSiteRepairBrief(brief, { documentOffset, expectedDocumentHash: expectedDocumentHash ?? undefined }))
}
