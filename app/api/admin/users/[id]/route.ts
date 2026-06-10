import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { Plan } from '@prisma/client'

const patchSchema = z.object({
  plan: z.enum(['FREE', 'BUILDER', 'TEAM', 'STUDIO']).optional(),
  auditsLimit: z.number().int().min(0).optional(),
})

function isAdmin(userId: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return adminIds.includes(userId)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id || !isAdmin(session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.plan ? { plan: parsed.data.plan as Plan } : {}),
      ...(parsed.data.auditsLimit !== undefined ? { auditsLimit: parsed.data.auditsLimit } : {}),
    },
    select: { id: true, email: true, plan: true, auditsLimit: true, auditsUsed: true },
  })

  return NextResponse.json(user)
}
