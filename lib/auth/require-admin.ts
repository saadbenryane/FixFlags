import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/api/errors'
import { isAdminUser } from '@/lib/auth/permissions'

export type AdminActor = {
  id: string
  role: string
  email: string
  sessionId: string
  authenticatedAt: Date
}

export async function requireAdmin(): Promise<AdminActor | NextResponse> {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => apiError('Administrator access could not be verified. Try again.', 503))
  if (session instanceof NextResponse) return session
  if (!session?.user?.id) {
    return apiError('Unauthorized', 401)
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, email: true, lifecycleStatus: true },
  })

  if (!admin || admin.lifecycleStatus !== 'ACTIVE' || !isAdminUser(admin)) {
    return apiError('Forbidden', 403)
  }

  const persisted = await prisma.session.findFirst({
    where: { id: session.session.id, userId: admin.id, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true },
  })
  if (!persisted) return apiError('Unauthorized', 401)
  return {
    id: admin.id,
    role: admin.role,
    email: admin.email,
    sessionId: persisted.id,
    authenticatedAt: persisted.createdAt,
  }
}

export function isAdminResponse(value: AdminActor | NextResponse): value is NextResponse {
  return value instanceof NextResponse
}
