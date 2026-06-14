import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'

const feedbackSchema = z.object({
  vote: z.number().min(-1).max(1),
  comment: z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: findingId } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = feedbackSchema.safeParse(body)
  if (!parsed.success) {
      return apiError('Choose a valid feedback value', 400, { code: 'INVALID_FEEDBACK' })
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  let feedback
  if (session?.user?.id) {
    feedback = await prisma.findingFeedback.upsert({
      where: { findingId_userId: { findingId, userId: session.user.id } },
      create: { findingId, userId: session.user.id, vote: parsed.data.vote, comment: parsed.data.comment ?? null },
      update: { vote: parsed.data.vote, comment: parsed.data.comment ?? null },
    })
  } else {
    feedback = await prisma.findingFeedback.create({
      data: { findingId, userId: null, vote: parsed.data.vote, comment: parsed.data.comment ?? null },
    })
  }

    return NextResponse.json(feedback)
  } catch (error) {
    return handleRouteError(error, 'Could not save feedback')
  }
}
