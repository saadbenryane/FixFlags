import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import {
  createOutcomeFixture,
  listOutcomeFixtures,
  OutcomeFixtureError,
  outcomeFixtureInputSchema,
} from '@/lib/sites/application/outcome-fixtures'
import { requireSiteOwner } from '@/lib/sites/request-access'

function fixtureError(error: unknown) {
  if (error instanceof OutcomeFixtureError) return apiError(error.message, error.status, { code: error.code })
  return handleRouteError(error, 'Could not manage Safe Form fixtures')
}

export async function GET(_request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const owner = await requireSiteOwner(siteId)
    if (!owner.ok) return apiError(owner.message, owner.status)
    return NextResponse.json({ fixtures: await listOutcomeFixtures(owner.projectId) })
  } catch (error) {
    return fixtureError(error)
  }
}

export async function POST(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const owner = await requireSiteOwner(siteId)
    if (!owner.ok) return apiError(owner.message, owner.status)
    const parsed = outcomeFixtureInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Complete every Safe Form field with valid values.', 400, { code: 'FIXTURE_INPUT_INVALID' })
    const fixture = await createOutcomeFixture({
      projectId: owner.projectId,
      siteUrl: owner.decision.site.url,
      fixture: parsed.data,
    })
    return NextResponse.json({ fixture }, { status: 201 })
  } catch (error) {
    return fixtureError(error)
  }
}
