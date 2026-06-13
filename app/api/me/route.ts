import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleRouteError } from '@/lib/api/errors'

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

    if (!session?.user?.id) {
      return NextResponse.json({ user: null })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, plan: true, name: true },
    })

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: user?.email ?? session.user.email,
        name: user?.name ?? session.user.name,
        plan: user?.plan ?? 'FREE',
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
