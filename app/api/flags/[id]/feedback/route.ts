import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { getOrCreateVisitorToken } from '@/lib/live-support/visitor-token'

const feedbackSchema = z.object({
  vote: z.number().min(-1).max(1),
  comment: z.string().max(500).optional(),
  reason: z
    .enum(['incorrect', 'intentional', 'already_fixed', 'low_priority', 'duplicate'])
    .optional(),
  dismiss: z.boolean().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: flagId } = await params

    const clientId = requestClientId(await headers())
    await recordRateLimit({ scope: 'flag-feedback', identifier: clientId, limit: 30, windowSeconds: 60 })

    const flag = await prisma.flag.findUnique({
      where: { id: flagId },
      select: { id: true, auditId: true, audit: { select: { userId: true } } },
    })
    if (!flag) return apiError('Flag not found', 404, { code: 'NOT_FOUND' })

    const body = await req.json().catch(() => ({}))
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Choose a valid feedback value', 400, { code: 'INVALID_FEEDBACK' })
    }

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const visitorToken = await getOrCreateVisitorToken()
    const reasonLabel = parsed.data.reason
      ? parsed.data.reason.replace(/_/g, ' ')
      : null
    const commentParts = [
      reasonLabel ? `Dismiss reason: ${reasonLabel}` : null,
      parsed.data.comment?.trim() || null,
    ].filter(Boolean)
    const comment = commentParts.length > 0 ? commentParts.join('. ') : null

    const feedback = await prisma.flagFeedback.upsert({
      where: { flagId_visitorToken: { flagId, visitorToken } },
      create: {
        flagId,
        visitorToken,
        userId: session?.user?.id ?? null,
        vote: parsed.data.vote,
        comment,
      },
      update: {
        vote: parsed.data.vote,
        comment,
        userId: session?.user?.id ?? null,
      },
    })

    const isOwner =
      Boolean(session?.user?.id) && flag.audit.userId === session?.user?.id
    if (parsed.data.dismiss && parsed.data.reason && isOwner) {
      await prisma.flag.update({
        where: { id: flagId },
        data: { status: 'IGNORED' },
      })
    }

    return NextResponse.json(feedback)
  } catch (error) {
    return handleRouteError(error, 'Could not save feedback')
  }
}
