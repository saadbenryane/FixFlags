import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { WorkspaceChatUnavailableError } from '@/lib/workspace/chat'
import {
  getReportChatHistory,
  ReportChatServiceError,
  sendReportChatMessage,
} from '@/lib/workspace/report-chat'

const schema = z.object({
  message: z.string().min(1).max(2000),
  observationAuditId: z.string().min(1).max(64).optional().nullable(),
})

async function requireSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

function chatError(error: unknown, fallback: string) {
  if (error instanceof ReportChatServiceError) {
    if (error.code === 'CHAT_ALLOWANCE_EXHAUSTED') {
      return NextResponse.json(
        { code: error.code, ...(error.details ?? {}) },
        { status: error.status }
      )
    }
    return apiError(error.message, error.status, {
      ...(error.code ? { code: error.code } : {}),
      ...(error.action ? { action: error.action } : {}),
    })
  }
  if (error instanceof WorkspaceChatUnavailableError) {
    return apiError('Chat is temporarily unavailable. Try again.', 503, {
      code: 'CHAT_UNAVAILABLE',
      action: 'retry',
    })
  }
  return handleRouteError(error, fallback)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireSessionUserId()
    if (!userId) return apiError('Sign in to use workspace chat', 401, { code: 'UNAUTHORIZED' })
    const { id: auditId } = await params
    return NextResponse.json(
      await getReportChatHistory({
        auditId,
        userId,
        observationAuditId: req.nextUrl.searchParams.get('observationAuditId'),
      })
    )
  } catch (error) {
    return chatError(error, 'Chat history unavailable')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await enforceRateLimit({
      scope: 'workspace_chat',
      identifier: requestClientId(req.headers),
      limit: 20,
      windowSeconds: 60,
      onRedisDown: 'reject',
    })

    const userId = await requireSessionUserId()
    if (!userId) return apiError('Sign in to use workspace chat', 401, { code: 'UNAUTHORIZED' })
    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('Message required', 400)
    const { id: auditId } = await params
    return NextResponse.json(
      await sendReportChatMessage({
        auditId,
        userId,
        message: parsed.data.message,
        observationAuditId: parsed.data.observationAuditId,
      })
    )
  } catch (error) {
    return chatError(error, 'Chat unavailable')
  }
}
