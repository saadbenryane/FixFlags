import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  getGscAccessToken,
  revokeGoogleGrant,
} from '@/lib/integrations/google-search-console'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user)
      return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const clientId = requestClientId(await headers())
    await enforceRateLimit({
      scope: 'gsc-disconnect',
      identifier: `${session.user.id}:${clientId}`,
      limit: 5,
      windowSeconds: 60,
    })

    const connection = await prisma.gscConnection.findUnique({
      where: { userId: session.user.id },
    })
    if (!connection) return NextResponse.json({ ok: true })

    try {
      const accessToken = await getGscAccessToken(session.user.id)
      if (accessToken) {
        await revokeGoogleGrant(accessToken)
      }
    } catch {
      // Token may already be invalid - still remove our local record.
    }

    await prisma.gscConnection.delete({
      where: { userId: session.user.id },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'Failed to disconnect Google Search Console')
  }
}
