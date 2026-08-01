import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/db'
import { runWorkspaceChat } from '@/lib/workspace/chat'

const schema = z.object({
  message: z.string().min(1).max(2000),
})

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
    })

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return apiError('Sign in to use workspace chat', 401, { code: 'UNAUTHORIZED' })
    }

    const { id: auditId } = await params
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { id: true, userId: true, url: true, status: true },
    })
    if (!audit) return apiError('Report not found', 404)
    if (audit.userId !== session.user.id) {
      return apiError('You can only chat on your own reports', 403)
    }

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('Message required', 400)

    const reply = await runWorkspaceChat({
      message: parsed.data.message,
      url: audit.url,
      status: audit.status,
    })

    return NextResponse.json({ reply })
  } catch (error) {
    return handleRouteError(error, 'Chat unavailable')
  }
}
