import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { EDITOR_INTEGRATION_KEYS } from '@/lib/integrations/editor-catalog'
import { notificationPreferencesPatchSchema } from '@/lib/notifications/preferences'
import { saveNotificationPreferences } from '@/lib/notifications/store'
import { NOTIFICATIONS_COPY } from '@/lib/marketing/copy/notifications'

const VALID_LEVELS = ['beginner', 'regular', 'advanced'] as const
const VALID_TOOLS = [...EDITOR_INTEGRATION_KEYS, 'other'] as const

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return apiError('Unauthorized', 401)
    }

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'me-preferences', identifier: `${session.user.id}:${clientId}`, limit: 20, windowSeconds: 60 })

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(NOTIFICATIONS_COPY.invalid, 400)
    if ('notifications' in body) {
      const parsed = notificationPreferencesPatchSchema.safeParse(body.notifications)
      if (!parsed.success) return apiError(NOTIFICATIONS_COPY.invalid, 400)
      const notifications = await saveNotificationPreferences(session.user.id, parsed.data)
      return NextResponse.json({ ok: true, notifications }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    const vibecodingLevel =
      typeof body.vibecodingLevel === 'string' &&
      (VALID_LEVELS as readonly string[]).includes(body.vibecodingLevel)
        ? body.vibecodingLevel
        : undefined

    const preferredTools: string[] | undefined = Array.isArray(body.preferredTools)
      ? body.preferredTools.filter((t: string) =>
          (VALID_TOOLS as readonly string[]).includes(t)
        )
      : undefined

    if (vibecodingLevel === undefined && preferredTools === undefined) {
      return apiError('No valid fields to update', 400)
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(vibecodingLevel !== undefined && { vibecodingLevel }),
        ...(preferredTools !== undefined && { preferredTools }),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
