import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canAccessAudit } from '@/lib/audit/access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await resolveSessionUser()

    const audit = await prisma.audit.findUnique({
      where: { id },
      select: {
        status: true,
        progress: true,
        errorMsg: true,
        startedAt: true,
        completedAt: true,
        url: true,
        userId: true,
        isPublic: true,
        parentId: true,
        screenshots: {
          select: { device: true, url: true, width: true, height: true },
        },
        areas: {
          select: { name: true, grade: true, score: true },
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!audit) {
      return apiError('Audit not found', 404)
    }

    if (!canAccessAudit(audit, session?.user)) {
      return apiError('You do not have access to this audit', 403)
    }

    return NextResponse.json(audit)
  } catch (err) {
    return handleRouteError(err)
  }
}
