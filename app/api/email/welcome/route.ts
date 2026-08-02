import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { sendNurtureEmail } from '@/lib/email/send'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) {
      return apiError('Sign in to send welcome email', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })
    }

    await enforceRateLimit({
      scope: 'welcome-email',
      identifier: session.user.id,
      limit: 5,
      windowSeconds: 60,
      onRedisDown: 'reject',
    })

    const result = await sendNurtureEmail(session.user.id, 'welcome')
    return NextResponse.json(result)
  } catch (err) {
    return handleRouteError(err, 'Failed to send welcome email')
  }
}
