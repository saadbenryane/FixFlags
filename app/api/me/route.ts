import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleRouteError } from '@/lib/api/errors'
import { recordRateLimit } from '@/lib/security/rate-limit'
import { meUserSelect, serializeMeUser } from '@/lib/auth/me-user'

export async function GET(request: Request) {
  try {
    const clientId = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'
    await recordRateLimit({ scope: 'api-me', identifier: clientId, limit: 60, windowSeconds: 60 })

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

    if (!session?.user?.id) {
      return NextResponse.json({ user: null })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: meUserSelect,
    })

    if (!user) {
      return NextResponse.json({ user: null })
    }

    const response = NextResponse.json({
      user: await serializeMeUser(user, session.user),
    })
    response.headers.set('Cache-Control', 'private, max-age=10')
    return response
  } catch (err) {
    return handleRouteError(err)
  }
}
