import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { getOrCreateVisitorToken } from '@/lib/live-support/visitor-token'

const feedbackSchema = z.object({
  vote: z.number().min(-1).max(1),
  comment: z.string().max(500).optional(),
  pageUrl: z.string().url().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auditId } = await params

    const clientId = requestClientId(await headers())
    await recordRateLimit({ scope: 'audit-feedback', identifier: clientId, limit: 30, windowSeconds: 60 })

    const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { id: true } })
    if (!audit) return apiError('Report not found', 404, { code: 'NOT_FOUND' })

    const body = await req.json().catch(() => ({}))
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Choose a valid feedback value', 400, { code: 'INVALID_FEEDBACK' })
    }

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const visitorToken = await getOrCreateVisitorToken()
    const comment = parsed.data.comment?.trim() || null

    const feedback = await prisma.auditFeedback.upsert({
      where: { auditId_visitorToken: { auditId, visitorToken } },
      create: {
        auditId,
        visitorToken,
        userId: session?.user?.id ?? null,
        vote: parsed.data.vote,
        comment,
        pageUrl: parsed.data.pageUrl ?? null,
      },
      update: {
        vote: parsed.data.vote,
        comment,
        userId: session?.user?.id ?? null,
        ...(parsed.data.pageUrl ? { pageUrl: parsed.data.pageUrl } : {}),
      },
    })

    return NextResponse.json({ id: feedback.id, vote: feedback.vote })
  } catch (error) {
    return handleRouteError(error, 'Could not save feedback')
  }
}
