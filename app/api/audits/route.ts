import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import {
  checkAnonymousAuditAllowed,
  reserveUserAuditSlot,
  trackAnonymousAuditId,
} from '@/lib/audit/usage'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { canAccessPaidFeatures } from '@/lib/auth/entitlements'

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

    const criticalPath = parsed.data.mode === 'critical_path'

    if (criticalPath) {
      if (!session?.user) {
        return apiError('Sign in and upgrade to Builder for critical path audits.', 402, {
          code: 'UPGRADE_REQUIRED',
          action: 'upgrade',
        })
      }
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, plan: true },
      })
      if (!user || !canAccessPaidFeatures(user)) {
        return apiError('Critical path audits require a Builder plan or above.', 402, {
          code: 'UPGRADE_REQUIRED',
          action: 'upgrade',
        })
      }
    }

    if (session?.user) {
      const limitCheck = await reserveUserAuditSlot(session.user.id)
      if (!limitCheck.allowed) {
        return apiError(limitCheck.error!, 402, {
          code: limitCheck.code,
          action: limitCheck.action,
        })
      }
    } else {
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
    return handleRouteError(err)
  }
}
