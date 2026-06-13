import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleRouteError } from '@/lib/api/errors'
import { isAdminUser, getScanUsage } from '@/lib/auth/permissions'
import { claimAnonymousAudits } from '@/lib/audit/claim-anonymous'

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

    if (!session?.user?.id) {
      return NextResponse.json({ user: null })
    }

    await claimAnonymousAudits(session.user.id)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        plan: true,
        name: true,
        role: true,
        auditsUsed: true,
        auditsLimit: true,
      },
    })

    if (!user) {
      return NextResponse.json({ user: null })
    }

    const tokens = await getScanUsage({
      id: session.user.id,
      role: user.role,
      auditsUsed: user.auditsUsed,
      auditsLimit: user.auditsLimit,
    })

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: user.email ?? session.user.email,
        name: user.name ?? session.user.name,
        plan: user.plan ?? 'FREE',
        role: user.role,
        isAdmin: isAdminUser({ id: session.user.id, role: user.role }),
        tokens,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
