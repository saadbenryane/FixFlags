import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/mcp/tools'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'
import { canonicalProductHost } from '@/lib/audit/product-intelligence'
import { normalizeAuditUrl } from '@/lib/audit/url'
import {
  isRailwayDeploySuccessEvent,
  parseRailwayWebhookPayload,
  resolveRailwayCheckUrl,
  railwayDeploymentReference,
} from '@/lib/webhooks/railway-deploy'
import { recordProductReleaseForReview } from '@/lib/signals/product-signals'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import {
  resolveWebhookApiKey,
  resolveWebhookCheckUrl,
  verifyWebhookSharedSecret,
} from '@/lib/webhooks/webhook-auth'

export async function POST(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get('apiKey')?.trim()) {
      return apiError('Send the FixFlags API key in the Authorization header.', 401)
    }
    if (!verifyWebhookSharedSecret(req, 'RAILWAY_WEBHOOK_SECRET')) {
      return apiError('Invalid webhook secret', 401)
    }

    const rawBody = await req.json().catch(() => null)
    const payload = parseRailwayWebhookPayload(rawBody)
    if (!payload) {
      return apiError('Invalid Railway webhook payload', 400)
    }

    if (!isRailwayDeploySuccessEvent(payload)) {
      return NextResponse.json({ ok: true, skipped: 'ignored_event', type: payload.type })
    }

    const checkUrl = resolveRailwayCheckUrl(payload, resolveWebhookCheckUrl(req))
    if (!checkUrl) {
      return apiError('Check URL required. Send the x-fixflags-check-url header.', 400)
    }
    const normalized = normalizeAuditUrl(checkUrl)
    if (!normalized.ok) return apiError(normalized.error, 400)

    const apiKey = resolveWebhookApiKey(req)
    const authContext = await validateApiKey(apiKey)
    if (!authContext) {
      return apiError('Valid FixFlags API key required in the Authorization header.', 401)
    }
    if (authContext.apiKey.audience) {
      return apiError('Deployment checks use a FixFlags API key, not an MCP access token.', 403)
    }

    const host = canonicalProductHost(normalized.url)
    const project = await prisma.project.findFirst({
      where: { userId: authContext.user.id, canonicalHost: host, deletedAt: null },
      select: {
        id: true,
        siteOutcomes: {
          where: { enabled: true },
          select: { id: true },
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!project) {
      return apiError('No owned Site matches this host.', 404)
    }

    const deployment = railwayDeploymentReference(payload)
    const outcomeIds = project.siteOutcomes.map((outcome) => outcome.id)
    if (outcomeIds.length === 0) {
      return apiError('Confirm an Outcome before a deployment can verify this Site.', 409)
    }
    const started = await requestSiteRun({
      projectId: project.id,
      outcomeIds,
      userId: authContext.user.id,
      source: 'DEPLOYMENT',
      idempotencyKey: `railway:${deployment.externalId}:${outcomeIds.join(',')}`,
      url: normalized.url,
      context: { deployment: deployment.externalId },
    })
    const auditId = started.auditId
    if (auditId) {
      await recordProductReleaseForReview({
        auditId,
        source: 'railway',
        externalId: deployment.externalId,
        commitRef: deployment.commitRef,
        url: normalized.url,
      })
    }

    logger.info('railway deployment check enqueued', {
      auditId,
      host,
      eventType: payload.type,
    })

    return NextResponse.json({
      ok: true,
      siteId: project.id,
      runId: 'runId' in started ? started.runId : null,
      auditId,
      mode: outcomeIds.length > 0 ? 'outcomes' : 'diagnostics',
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
