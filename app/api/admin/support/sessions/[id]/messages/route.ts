import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import {
  listMessages,
  sendAgentMessage,
  markReadByAgent,
  serializeMessage,
} from '@/lib/live-support'
import { prisma } from '@/lib/db'
import { recordRateLimit } from '@/lib/security/rate-limit'

const postSchema = z.object({
  body: z.string().min(1).max(4000),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const session = await prisma.supportSession.findUnique({ where: { id } })
    if (!session) return apiError('Not found', 404)

    const messages = await listMessages(id)
    return NextResponse.json({ messages: messages.map(serializeMessage) })
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid message', 400)
    }

    const limit = await recordRateLimit({
      scope: 'support-agent',
      identifier: admin.id,
      limit: 120,
      windowSeconds: 3600,
    })
    if (limit.exceeded) {
      return apiError('Rate limit exceeded', 429)
    }

    const message = await sendAgentMessage(id, admin.id, parsed.data.body)
    return NextResponse.json({ message: serializeMessage(message) }, { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    await markReadByAgent(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
