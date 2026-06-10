import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

const feedbackSchema = z.object({
  vote: z.number().min(-1).max(1),
  comment: z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: findingId } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = feedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 })
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  const feedback = await prisma.findingFeedback.upsert({
    where: {
      findingId_userId: {
        findingId,
        userId: session?.user?.id ?? 'anonymous',
      },
    },
    create: {
      findingId,
      userId: session?.user?.id ?? null,
      vote: parsed.data.vote,
      comment: parsed.data.comment ?? null,
    },
    update: {
      vote: parsed.data.vote,
      comment: parsed.data.comment ?? null,
    },
  })

  return NextResponse.json(feedback)
}
