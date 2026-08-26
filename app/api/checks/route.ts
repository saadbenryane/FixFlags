import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import {
  AuditLimitError,
  ParentAuditError,
} from '@/lib/audit/create-audit'
import { checkAndPlan } from '@/lib/audit/task-contracts'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { scanAccessInputSchema, parseScanAccessInput } from '@/lib/audit/scan-access'
import { canUseEphemeralScanAccess } from '@/lib/audit/scan-access-auth'
import { prisma } from '@/lib/db'
import { enforceRateLimit, recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { computeEnqueueDelay, getWorkerQueueEstimate } from '@/lib/queue/estimate'
import { buildAttribution, parseClientAuditSource } from '@/lib/leads/attribution'

const createSchema = z.object({
  url: z.string().url('Enter a valid URL that starts with https://'),
  mode: z.enum(['single', 'critical_path']).optional(),
  parentId: z.string().optional(),
  source: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  scanAccess: scanAccessInputSchema.optional(),
})

export async function POST(req: NextRequest) {
  const requestStartedAt = performance.now()
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid URL', 400)
    }

    const urlResult = normalizeAuditUrl(parsed.data.url)
    if (!urlResult.ok) {
      return apiError(urlResult.error, 400)
    }
    const { url } = urlResult

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const clientId = requestClientId(req.headers)

    const criticalPath = parsed.data.mode !== 'single'

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
        onRedisDown: 'reject',
      }),
      enforceRateLimit({
        scope: 'audit-host-hard',
        identifier: new URL(url).hostname,
        limit: 120,
        windowSeconds: 3600,
        onRedisDown: 'reject',
      }),
    ])

    const [userLimit, hostLimit, workerEstimate] = await Promise.all([
      recordRateLimit({
        scope: session?.user ? 'audit-user' : 'audit-client',
        identifier: session?.user ? session?.user.id : clientId,
        limit: session?.user ? 30 : 10,
        windowSeconds: 3600,
        onRedisDown: 'reject',
      }),
      recordRateLimit({
        scope: 'audit-host',
        identifier: new URL(url).hostname,
        limit: 20,
        windowSeconds: 3600,
        onRedisDown: 'reject',
      }),
      getWorkerQueueEstimate(),
    ])

    const rateLimitRetryAfter = Math.max(
      userLimit.exceeded ? userLimit.retryAfterSeconds : 0,
      hostLimit.exceeded ? hostLimit.retryAfterSeconds : 0
    )

    const queueInfo = computeEnqueueDelay(
      rateLimitRetryAfter,
      workerEstimate
    )
    const { delayMs } = queueInfo

    const referer = req.headers.get('referer')
    const refererPath = referer ? (() => { try { return new URL(referer).pathname } catch { return null } })() : null
    const clientSource = parseClientAuditSource(parsed.data.source)
    if (parsed.data.scanAccess) {
      if (!session?.user) {
        return apiError('Sign in required for preview scan access', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })
      }
      const scanAccessUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, plan: true, subscriptionStatus: true },
      })
      if (!scanAccessUser || !canUseEphemeralScanAccess(scanAccessUser)) {
        return apiError('Preview scan access requires the Studio plan', 402, {
          code: 'UPGRADE_REQUIRED',
          action: 'view_pricing',
        })
      }
    }
    const scanAccess =
      session?.user && parsed.data.scanAccess
        ? parseScanAccessInput(parsed.data.scanAccess)
        : null
    if (parsed.data.scanAccess && session?.user && !scanAccess) {
      return apiError('Scan access must include HTTP basic auth, cookies, or headers', 400)
    }
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

    const outcome = await checkAndPlan({
      url,
      userId: session?.user?.id ?? null,
      parentId: parsed.data.parentId,
      clientId: session?.user ? undefined : clientId,
      auditMode: criticalPath ? 'CRITICAL_PATH' : 'SINGLE',
      delayMs,
      attribution,
      scanAccess,
    })

    return NextResponse.json(
      {
        reportId: outcome.reportId,
        reportUrl: outcome.reportUrl,
        status: outcome.status,
        reused: Boolean(outcome.reused),
        isLoggedIn: Boolean(session?.user),
        queued: queueInfo.queued,
        queueReason: queueInfo.queueReason,
        queue: queueInfo.queue,
      },
      {
        status: 201,
        headers: {
          'Server-Timing': `check-create;dur=${(
            performance.now() - requestStartedAt
          ).toFixed(1)}`,
        },
      }
    )
  } catch (err) {
    if (err instanceof AuditLimitError) {
      return apiError(err.message, 402, { code: err.code, action: err.action })
    }
    if (err instanceof ParentAuditError) {
      return apiError(err.message, err.status, {
        code: err.status === 401 ? 'AUTH_REQUIRED' : 'PARENT_AUDIT_INVALID',
      })
    }
    return handleRouteError(err)
  }
}
