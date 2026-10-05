import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import {
  deleteOutcomeFixture,
  OutcomeFixtureError,
  outcomeFixtureInputSchema,
  updateOutcomeFixture,
} from '@/lib/sites/application/outcome-fixtures'
import { requireSiteOwner } from '@/lib/sites/request-access'

function fixtureError(error: unknown) {
  if (error instanceof OutcomeFixtureError) return apiError(error.message, error.status, { code: error.code })
  return handleRouteError(error, 'Could not manage this Safe Form fixture')
}

export async function PATCH(request: Request, context: { params: Promise<{ siteId: string; fixtureId: string }> }) {
  try {
    const { siteId, fixtureId } = await context.params
    const owner = await requireSiteOwner(siteId)
    if (!owner.ok) return apiError(owner.message, owner.status)
    const parsed = outcomeFixtureInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Complete every Safe Form field with valid values.', 400, { code: 'FIXTURE_INPUT_INVALID' })
    const fixture = await updateOutcomeFixture({
      projectId: owner.projectId,
      fixtureId,
      siteUrl: owner.decision.site.url,
      fixture: parsed.data,
    })
    return NextResponse.json({ fixture })
  } catch (error) {
    return fixtureError(error)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ siteId: string; fixtureId: string }> }) {
  try {
    const { siteId, fixtureId } = await context.params
    const owner = await requireSiteOwner(siteId)
    if (!owner.ok) return apiError(owner.message, owner.status)
    await deleteOutcomeFixture(owner.projectId, fixtureId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fixtureError(error)
  }
}
