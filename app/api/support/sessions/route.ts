import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { prisma } from '@/lib/db'
import { getOrCreateVisitorToken } from '@/lib/live-support/visitor-token'
import { resumeOrCreateSession, serializeSession } from '@/lib/live-support'
import { getDefaultSupportTenant } from '@/lib/live-support/tenant'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'

const postSchema = z.object({
  pageUrl: z.string().url().optional(),
  auditId: z.string().min(1).optional(),
  visitorName: z.string().max(120).optional(),
  visitorEmail: z.string().email().optional(),
  /** Required to create a new conversation; resume-only when omitted. */
  firstMessage: z.string().min(1).max(8000).optional(),
  projectId: z.string().min(1).max(128).optional(),
  flagId: z.string().min(1).max(128).optional(),
  transcriptSummary: z.string().max(4000).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'support-session', identifier: clientId, limit: 10, windowSeconds: 60 })

    const body = await req.json().catch(() => ({}))
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request', 400)
    }

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (parsed.data.projectId) {
      if (!session?.user?.id) return apiError('Sign in to contact support about a Site.', 401)
      const owned = await prisma.project.findFirst({
        where: { id: parsed.data.projectId, userId: session.user.id },
        select: { id: true },
      })
      if (!owned) return apiError('Site not found.', 404)
    }
    const visitorToken = await getOrCreateVisitorToken()

    const supportSession = await resumeOrCreateSession({
      visitorToken,
      userId: session?.user?.id ?? null,
      pageUrl: parsed.data.pageUrl ?? null,
      auditId: parsed.data.auditId ?? null,
      visitorName: parsed.data.visitorName ?? session?.user?.name ?? null,
      visitorEmail: parsed.data.visitorEmail ?? session?.user?.email ?? null,
      firstMessage: parsed.data.firstMessage ?? null,
      projectId: parsed.data.projectId ?? null,
      flagId: parsed.data.flagId ?? null,
      transcriptSummary: parsed.data.transcriptSummary ?? null,
    })

    if (!supportSession) {
      return NextResponse.json({ session: null })
    }

    if (parsed.data.projectId && session?.user?.id) {
      await recordSiteLifecycleEvent({
        name: 'agent_escalated',
        idempotencyKey: `agent-escalated:${supportSession.id}`,
        userId: session.user.id,
        projectId: parsed.data.projectId,
        properties: { hasFlag: Boolean(parsed.data.flagId) },
      })
    }

    return NextResponse.json({ session: serializeSession(supportSession) })
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function GET() {
  try {
    const visitorToken = await getOrCreateVisitorToken()
    const tenant = await getDefaultSupportTenant()
    const supportSession = await prisma.supportSession.findFirst({
      where: {
        tenantId: tenant.id,
        visitorToken,
        status: { in: ['OPEN', 'WAITING', 'ACTIVE'] },
        lastMessageAt: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!supportSession) {
      return NextResponse.json({ session: null })
    }

    return NextResponse.json({ session: serializeSession(supportSession) })
  } catch (err) {
    return handleRouteError(err)
  }
}
