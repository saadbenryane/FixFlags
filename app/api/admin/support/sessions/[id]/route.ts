import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { serializeSession } from '@/lib/live-support'
import { prisma } from '@/lib/db'

export async function PATCH() {
  const actor = await requireAdmin()
  if (isAdminResponse(actor)) return actor
  return apiError('Review and confirm conversation changes through the admin action service.', 409)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const session = await prisma.supportSession.findUnique({
      where: { id },
      include: {
        assignedAgent: { select: { name: true, email: true } },
        project: { select: { id: true, name: true, url: true } },
        lead: { select: { normalizedDomain: true, latestScore: true, status: true } },
        user: { select: { id: true, email: true, plan: true, name: true } },
      },
    })
    if (!session) return apiError('Not found', 404)

    return NextResponse.json(
      {
        session: {
          ...serializeSession(session),
          lead: session.lead,
          user: session.user,
          project: session.project,
          assignedAgentId: session.assignedAgentId,
          assignee: session.assignedAgent,
          currentAdminId: admin.id,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
