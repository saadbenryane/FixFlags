import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { readVisitorToken } from '@/lib/live-support/visitor-token'
import {
  getSessionForVisitor,
  listMessages,
  sendVisitorMessage,
  markReadByVisitor,
  serializeMessage,
} from '@/lib/live-support'
import { recordRateLimit } from '@/lib/security/rate-limit'

const postSchema = z.object({
  body: z.string().min(1).max(4000),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const visitorToken = await readVisitorToken()
    if (!visitorToken) return apiError('Unauthorized', 401)

    const session = await getSessionForVisitor(id, visitorToken)
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
    const { id } = await params
    const visitorToken = await readVisitorToken()
    if (!visitorToken) return apiError('Unauthorized', 401)

    const session = await getSessionForVisitor(id, visitorToken)
    if (!session) return apiError('Not found', 404)

    const body = await req.json().catch(() => ({}))
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid message', 400)
    }

    const limit = await recordRateLimit({
      scope: 'support-visitor',
      identifier: visitorToken,
      limit: 20,
      windowSeconds: 3600,
    })
    if (limit.exceeded) {
      return apiError('Too many messages. Please wait before sending more.', 429)
    }

    const message = await sendVisitorMessage(id, parsed.data.body)
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
    const { id } = await params
    const visitorToken = await readVisitorToken()
    if (!visitorToken) return apiError('Unauthorized', 401)

    const session = await getSessionForVisitor(id, visitorToken)
    if (!session) return apiError('Not found', 404)

    await markReadByVisitor(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
