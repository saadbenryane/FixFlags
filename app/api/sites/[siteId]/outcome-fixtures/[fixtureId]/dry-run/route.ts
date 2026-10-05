import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { dryRunOutcomeFixture, OutcomeFixtureError } from '@/lib/sites/application/outcome-fixtures'
import { requireSiteOwner } from '@/lib/sites/request-access'

export async function POST(_request: Request, context: { params: Promise<{ siteId: string; fixtureId: string }> }) {
  try {
    const { siteId, fixtureId } = await context.params
    const owner = await requireSiteOwner(siteId)
    if (!owner.ok) return apiError(owner.message, owner.status)
    return NextResponse.json({ fixture: await dryRunOutcomeFixture({ projectId: owner.projectId, fixtureId }) })
  } catch (error) {
    if (error instanceof OutcomeFixtureError) return apiError(error.message, error.status, { code: error.code })
    return handleRouteError(error, 'Could not exercise this Safe Form fixture')
  }
}
