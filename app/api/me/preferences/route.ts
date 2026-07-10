import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

const VALID_LEVELS = ['beginner', 'regular', 'advanced'] as const
const VALID_TOOLS = ['cursor', 'claudeCode', 'windsurf', 'lovable', 'bolt', 'other'] as const

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return apiError('Unauthorized', 401)
    }

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'me-preferences', identifier: `${session.user.id}:${clientId}`, limit: 20, windowSeconds: 60 })

    const body = await req.json().catch(() => ({}))
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
