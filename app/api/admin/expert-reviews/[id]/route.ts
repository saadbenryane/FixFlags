import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'

const schema = z.object({
  summary: z.string().min(40).max(20_000),
  priorities: z.array(
    z.object({
      title: z.string().min(3).max(200),
      rationale: z.string().min(10).max(2_000),
      action: z.string().min(10).max(4_000),
    })
  ).min(1).max(10),
  reportUrl: z.string().url().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const body = await req.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.errors[0]?.message ?? 'Invalid review', 400)
    }

    const { id } = await params
    const order = await prisma.expertReviewOrder.findUnique({ where: { id } })
    if (!order || !['PAID', 'IN_REVIEW'].includes(order.status)) {
      return apiError('Paid review order not found', 404)
    }

    const deliverable = await prisma.$transaction(async (tx) => {
      const saved = await tx.expertReviewDeliverable.upsert({
        where: { orderId: id },
        create: {
          orderId: id,
          summary: parsed.data.summary,
          priorities: parsed.data.priorities,
          reportUrl: parsed.data.reportUrl ?? null,
          authoredBy: admin.id,
        },
        update: {
          summary: parsed.data.summary,
          priorities: parsed.data.priorities,
          reportUrl: parsed.data.reportUrl ?? null,
          authoredBy: admin.id,
        },
      })
      await tx.expertReviewOrder.update({
        where: { id },
        data: { status: 'IN_REVIEW' },
      })
      await tx.expertReviewEvent.upsert({
        where: { orderId_type: { orderId: id, type: 'AUTHORING_STARTED' } },
        create: { orderId: id, actorId: admin.id, type: 'AUTHORING_STARTED' },
        update: { actorId: admin.id },
      })
      return saved
    })

    return NextResponse.json({ deliverable })
  } catch (error) {
    return handleRouteError(error, 'Failed to save Expert Review')
  }
}
