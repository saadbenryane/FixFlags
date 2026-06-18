import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { sendExpertReviewDelivered } from '@/lib/email/expert-review'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const order = await prisma.expertReviewOrder.findUnique({
      where: { id },
      include: { deliverable: true },
    })
    if (!order || !order.userId) return apiError('Review order not found', 404)
    if (!order.deliverable?.summary || !Array.isArray(order.deliverable.priorities)) {
      return apiError('A complete deliverable is required before delivery', 409, {
        code: 'DELIVERABLE_REQUIRED',
        action: 'author_review',
      })
    }

    await sendExpertReviewDelivered({
      userId: order.userId,
      email: order.email,
      orderId: order.id,
    })

    const deliveredAt = order.deliverable.deliveredAt ?? new Date()
    await prisma.$transaction([
      prisma.expertReviewDeliverable.update({
        where: { orderId: id },
        data: { deliveredAt },
      }),
      prisma.expertReviewOrder.update({
        where: { id },
        data: { status: 'DELIVERED' },
      }),
      prisma.expertReviewEvent.upsert({
        where: { orderId_type: { orderId: id, type: 'DELIVERED' } },
        create: {
          orderId: id,
          actorId: admin.id,
          type: 'DELIVERED',
          metadata: { deliveredAt: deliveredAt.toISOString() },
        },
        update: { actorId: admin.id },
      }),
    ])

    return NextResponse.json({ delivered: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to deliver Expert Review')
  }
}
