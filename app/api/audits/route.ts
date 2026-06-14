import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import {
  AuditLimitError,
  createAndEnqueueAudit,
} from '@/lib/audit/create-audit'
import { checkAnonymousAuditAllowed, trackAnonymousAuditId } from '@/lib/audit/usage'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { canAccessPaidFeatures } from '@/lib/auth/entitlements'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

const createSchema = z.object({
  url: z.string().url('Invalid URL — please include https://'),
  mode: z.enum(['single', 'critical_path']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(parsed.error.errors[0]?.message ?? 'Invalid URL', 400)
    }

    const urlResult = normalizeAuditUrl(parsed.data.url)
    if (!urlResult.ok) {
      return apiError(urlResult.error, 400)
    }
    const { url } = urlResult

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    await Promise.all([
      enforceRateLimit({
        scope: session?.user ? 'audit-user' : 'audit-client',
        identifier: session?.user?.id ?? requestClientId(req.headers),
        limit: session?.user ? 30 : 3,
        windowSeconds: 3600,
      }),
      enforceRateLimit({
        scope: 'audit-host',
        identifier: new URL(url).hostname,
        limit: 20,
        windowSeconds: 3600,
      }),
    ])

    const criticalPath = parsed.data.mode === 'critical_path'

    if (criticalPath) {
      if (!session?.user) {
        return apiError('Sign in and upgrade to Pro for critical path audits.', 402, {
          code: 'UPGRADE_REQUIRED',
          action: 'upgrade',
        })
      }
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, plan: true },
      })
      if (!user || !canAccessPaidFeatures(user)) {
        return apiError('Critical path audits require the Pro plan or above.', 402, {
          code: 'UPGRADE_REQUIRED',
          action: 'upgrade',
        })
      }
    }

    if (!session?.user) {
      const anonCheck = await checkAnonymousAuditAllowed()
      if (!anonCheck.allowed) {
        return apiError(anonCheck.error!, 402, {
          code: anonCheck.code,
          action: anonCheck.action,
        })
      }
    }

    const { auditId, status } = await createAndEnqueueAudit({
      url,
      userId: session?.user?.id ?? null,
      auditMode: criticalPath ? 'CRITICAL_PATH' : 'SINGLE',
    })

    if (!session?.user) {
      await trackAnonymousAuditId(auditId)
    }

    return NextResponse.json({ auditId, status }, { status: 201 })
  } catch (err) {
    if (err instanceof AuditLimitError) {
      return apiError(err.message, 402, { code: err.code, action: 'upgrade' })
    }
    return handleRouteError(err)
  }
}
