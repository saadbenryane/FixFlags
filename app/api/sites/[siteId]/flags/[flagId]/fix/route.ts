import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'

const schema = z.object({
  action: z.enum(['copy']),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string; flagId: string }> }
) {
  try {
    const access = await requireSiteAccess((await context.params).siteId)
    if (!access.ok) return apiError(access.message, access.status)

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const { flagId } = await context.params
    const body = schema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) return apiError('Invalid action', 400)

    if (session?.user?.id) {
      await executeSiteCommand({
        type: 'RECORD_FIX_HANDOFF',
        flagId,
        userId: session.user.id,
        builder: 'copy',
      }).catch(() => null)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
