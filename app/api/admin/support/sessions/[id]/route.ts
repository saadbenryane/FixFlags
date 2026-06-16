import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { updateSessionStatus, serializeSession } from '@/lib/live-support'
import { prisma } from '@/lib/db'

const patchSchema = z.object({
  status: z.enum(['OPEN', 'WAITING', 'ACTIVE', 'CLOSED']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Invalid request', 400)
    }

    const existing = await prisma.supportSession.findUnique({ where: { id } })
    if (!existing) return apiError('Not found', 404)

    const session = await updateSessionStatus(id, parsed.data.status, admin.id)
    return NextResponse.json({ session: serializeSession(session) })
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const session = await prisma.supportSession.findUnique({
      where: { id },
      include: {
        lead: { select: { normalizedDomain: true, latestScore: true, status: true } },
        user: { select: { email: true, plan: true, name: true } },
      },
    })
    if (!session) return apiError('Not found', 404)

    return NextResponse.json({
      session: {
        ...serializeSession(session),
        lead: session.lead,
        user: session.user,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
