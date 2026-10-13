import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { serializeMessage, markReadByAgent } from '@/lib/live-support/messages'
import { requireAdminOrigin, adminPrivateHeaders } from '@/lib/admin/http'
function cursor(value: string | null) {
  if (!value || !/^\d{1,19}$/.test(value)) throw new Error('Invalid message cursor')
  return BigInt(value)
}
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    const { id } = await params
    const session = await prisma.supportSession.findUnique({
      where: { id },
      select: { agentReadThrough: true, unreadByAgent: true },
    })
    if (!session) return apiError('Conversation not found', 404)
    const after = req.nextUrl.searchParams.get('after'),
      before = req.nextUrl.searchParams.get('before')
    if (after && before) return apiError('Choose one message cursor', 400)
    const ascending = Boolean(after) || (!before && session.unreadByAgent > 0)
    let sequence: { gt?: bigint; lt?: bigint } | undefined
    try {
      sequence = after
        ? { gt: cursor(after) }
        : before
          ? { lt: cursor(before) }
          : session.unreadByAgent > 0
            ? { gt: session.agentReadThrough }
            : undefined
    } catch {
      return apiError('Invalid message cursor', 400)
    }
    const rows = await prisma.supportMessage.findMany({
      where: { sessionId: id, sequence },
      orderBy: { sequence: ascending ? 'asc' : 'desc' },
      take: 51,
      select: { id: true, role: true, body: true, createdAt: true, senderId: true, sequence: true },
    })
    const more = rows.length > 50,
      limited = rows.slice(0, 50),
      messages = ascending ? limited : limited.reverse()
    return NextResponse.json(
      {
        messages: messages.map(serializeMessage),
        more,
        oldest: messages[0]?.sequence.toString() ?? null,
        newest: messages.at(-1)?.sequence.toString() ?? null,
      },
      { headers: adminPrivateHeaders },
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
export async function POST() {
  const actor = await requireAdmin()
  if (isAdminResponse(actor)) return actor
  return apiError('Review and confirm replies through the admin action service.', 409)
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdminOrigin(req)
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    const { through } = await req.json()
    if (typeof through !== 'string' || !/^\d{1,19}$/.test(through))
      return apiError('A read cursor is required', 400)
    await markReadByAgent((await params).id, BigInt(through))
    return NextResponse.json({ ok: true }, { headers: adminPrivateHeaders })
  } catch (err) {
    return handleRouteError(err)
  }
}
