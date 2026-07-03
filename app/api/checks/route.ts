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
import { enforceRateLimit, recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { computeEnqueueDelay, getWorkerQueueEstimate } from '@/lib/queue/estimate'
import { buildAttribution, parseClientAuditSource } from '@/lib/leads/attribution'

const createSchema = z.object({
  url: z.string().url('Invalid URL, please include https://'),
  mode: z.enum(['single', 'critical_path']).optional(),
  source: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
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
    const clientId = requestClientId(req.headers)

    const criticalPath = parsed.data.mode === 'critical_path'

    if (criticalPath) {
      if (!session?.user) {
        return apiError('Sign in and upgrade to Pro for critical path checks.', 402, {
          code: 'UPGRADE_REQUIRED',
          action: 'upgrade',
        })
      }
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, plan: true, subscriptionStatus: true },
      })
      if (!user || !canAccessPaidFeatures(user)) {
        return apiError('Critical path checks require the Pro plan or above.', 402, {
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

    // Hard abuse ceilings, on separate counters from the soft delay limits below.
    // Normal bursts stay delay-queued; only egregious flooding from a single
    // client or against a single target is rejected outright (429). This stops a
    // free/anonymous caller from filling the worker queue and screenshot storage.
    await Promise.all([
      enforceRateLimit({
        scope: session?.user ? 'audit-user-hard' : 'audit-client-hard',
        identifier: session?.user?.id ?? clientId,
        limit: session?.user ? 120 : 60,
        windowSeconds: 3600,
      }),
      enforceRateLimit({
        scope: 'audit-host-hard',
        identifier: new URL(url).hostname,
        limit: 120,
        windowSeconds: 3600,
      }),
    ])

    const [userLimit, hostLimit, workerEstimate] = await Promise.all([
      recordRateLimit({
        scope: session?.user ? 'audit-user' : 'audit-client',
        identifier: session?.user?.id ?? clientId,
        limit: session?.user ? 30 : 10,
        windowSeconds: 3600,
      }),
      recordRateLimit({
        scope: 'audit-host',
        identifier: new URL(url).hostname,
        limit: 20,
        windowSeconds: 3600,
      }),
      getWorkerQueueEstimate(),
    ])

    const rateLimitRetryAfter = Math.max(
      userLimit.exceeded ? userLimit.retryAfterSeconds : 0,
      hostLimit.exceeded ? hostLimit.retryAfterSeconds : 0
    )

    const { delayMs, estimatedWaitSeconds, queuePosition, scheduledStartAt } = computeEnqueueDelay(
      rateLimitRetryAfter,
      workerEstimate
    )

    const referer = req.headers.get('referer')
    const refererPath = referer ? (() => { try { return new URL(referer).pathname } catch { return null } })() : null
    const clientSource = parseClientAuditSource(parsed.data.source)
    const attribution = buildAttribution({
      url,
      source: clientSource,
      referer,
      pathname: refererPath ?? req.nextUrl.pathname,
      searchParams: req.nextUrl.searchParams,
      utmSource: parsed.data.utmSource,
      utmMedium: parsed.data.utmMedium,
      utmCampaign: parsed.data.utmCampaign,
      gclid: parsed.data.gclid,
      fbclid: parsed.data.fbclid,
    })

    const { auditId, status } = await createAndEnqueueAudit({
      url,
      userId: session?.user?.id ?? null,
      auditMode: criticalPath ? 'CRITICAL_PATH' : 'SINGLE',
      delayMs,
      attribution,
    })

    if (!session?.user) {
      await trackAnonymousAuditId(auditId)
    }

    return NextResponse.json(
      {
        reportId: auditId,
        status,
        estimatedWaitSeconds,
        queuePosition,
        scheduledStartAt,
        queued: delayMs > 0 || workerEstimate.waitingJobs > 0,
        queueReason:
          delayMs > 0 ? ('rate_limit' as const) : workerEstimate.waitingJobs > 0 ? ('backlog' as const) : undefined,
      },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof AuditLimitError) {
      return apiError(err.message, 402, { code: err.code, action: 'upgrade' })
    }
    return handleRouteError(err)
  }
}
