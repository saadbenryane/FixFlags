import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { handleRouteError, apiError } from '@/lib/api/errors'

const schema = z.object({
  outcomeId: z.string().min(1),
  confirmed: z.boolean(),
  name: z.string().max(120).optional(),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await context.params
    const body = schema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) return apiError('Invalid outcome update', 400)

    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId,
      outcomeId: body.data.outcomeId,
      confirmed: body.data.confirmed,
      name: body.data.name,
    })
    if (!result.ok) return apiError(result.error, 404)
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
