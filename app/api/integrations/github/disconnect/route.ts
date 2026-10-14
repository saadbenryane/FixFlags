import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { disconnectGithubAuthorization } from '@/lib/integrations/github-connection'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'github-disconnect', identifier: `${session.user.id}:${clientId}`, limit: 5, windowSeconds: 60 })

    return NextResponse.json(await disconnectGithubAuthorization(session.user.id))
  } catch (err) {
    return handleRouteError(err, 'Failed to disconnect GitHub')
  }
}
