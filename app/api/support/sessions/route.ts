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

const postSchema = z.object({
  pageUrl: z.string().url().optional(),
  auditId: z.string().min(1).optional(),
  visitorName: z.string().max(120).optional(),
  visitorEmail: z.string().email().optional(),
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
    const visitorToken = await getOrCreateVisitorToken()

    const supportSession = await resumeOrCreateSession({
      visitorToken,
      userId: session?.user?.id ?? null,
      pageUrl: parsed.data.pageUrl ?? null,
      auditId: parsed.data.auditId ?? null,
      visitorName: parsed.data.visitorName ?? session?.user?.name ?? null,
      visitorEmail: parsed.data.visitorEmail ?? session?.user?.email ?? null,
    })

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
