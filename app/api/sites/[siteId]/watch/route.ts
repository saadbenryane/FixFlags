import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { handleRouteError, apiError } from '@/lib/api/errors'

const schema = z.object({
  interval: z.enum(['weekly', 'daily']).nullable(),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Sign in to keep watching this Site.', signup: true },
        { status: 401 }
      )
    }

    const { siteId } = await context.params
    const body = schema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) return apiError('Choose a watch interval', 400)

    const result = await executeSiteCommand({
      type: 'SET_WATCH',
      siteId,
      userId: session.user.id,
      interval: body.data.interval,
    })

    if ('ok' in result && result.ok === false) {
      return apiError(result.error, 400, { code: 'code' in result ? result.code : undefined })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
