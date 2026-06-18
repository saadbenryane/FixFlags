import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Plan } from '@prisma/client'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { applyPlanLimits } from '@/lib/billing/limits'
import { UNLIMITED_SCAN_LIMIT } from '@/lib/auth/permissions'

const patchSchema = z.object({
  plan: z.enum(['FREE', 'BUILDER', 'TEAM', 'STUDIO']).optional(),
  auditsLimit: z.number().int().optional(),
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

    if (parsed.data.plan) {
      await applyPlanLimits(id, parsed.data.plan as Plan)
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.auditsLimit !== undefined
          ? { auditsLimit: parsed.data.auditsLimit }
          : {}),
      },
      select: { id: true, email: true, plan: true, auditsLimit: true, auditsUsed: true, role: true },
    })

    if (user.role === 'admin' && user.auditsLimit !== UNLIMITED_SCAN_LIMIT) {
      const fixed = await prisma.user.update({
        where: { id },
        data: { auditsLimit: UNLIMITED_SCAN_LIMIT },
        select: { id: true, email: true, plan: true, auditsLimit: true, auditsUsed: true, role: true },
      })
      return NextResponse.json(fixed)
    }

    return NextResponse.json(user)
  } catch (err) {
    return handleRouteError(err)
  }
}
