import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/api/errors'
import { isAdminUser } from '@/lib/auth/permissions'

type AdminUser = {
  id: string
  role: string
  email: string
}

export async function requireAdmin(): Promise<AdminUser | NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) {
    return apiError('Unauthorized', 401)
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, email: true },
  })

  if (!admin || !isAdminUser(admin)) {
    return apiError('Forbidden', 403)
  }

  return admin
}

export function isAdminResponse(value: AdminUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse
}
