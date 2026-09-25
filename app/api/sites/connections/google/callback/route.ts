import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { completeGoogleConnection } from '@/lib/sites/connections/google'
import { getAuthBaseUrl } from '@/lib/auth/env'

export async function GET(request: NextRequest) {
  const base = getAuthBaseUrl().replace(/\/$/, '')
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  if (!session?.user?.id || !code || !state) {
    return NextResponse.redirect(`${base}/sign-in?next=/dashboard`)
  }
  try {
    const result = await completeGoogleConnection({
      state,
      code,
      sessionUserId: session.user.id,
      hostForProject: async (projectId, userId) => {
        const project = await prisma.project.findFirst({
          where: { id: projectId, userId, deletedAt: null },
          select: { canonicalHost: true },
        })
        return project?.canonicalHost ?? null
      },
    })
    if ('error' in result) return NextResponse.redirect(`${base}/dashboard`)
    return NextResponse.redirect(`${base}/sites/${result.projectId}/settings`)
  } catch {
    return NextResponse.redirect(`${base}/dashboard`)
  }
}
