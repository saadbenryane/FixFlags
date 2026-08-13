import { NextRequest, NextResponse } from 'next/server'
import { checkAndPlan } from '@/lib/audit/task-contracts'
import { validateApiKey } from '@/lib/mcp/tools'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'
import {
  isRailwayDeploySuccessEvent,
  parseRailwayWebhookPayload,
  resolveRailwayCheckUrl,
  railwayDeploymentReference,
} from '@/lib/webhooks/railway-deploy'
import { recordProductReleaseForReview } from '@/lib/signals/product-signals'
import {
  resolveWebhookApiKey,
  resolveWebhookCheckUrl,
  verifyWebhookSharedSecret,
} from '@/lib/webhooks/webhook-auth'

export async function POST(req: NextRequest) {
  try {
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
      return apiError(
        'Check URL required. Add ?url=https://your-service.up.railway.app to the Railway webhook URL.',
        400
      )
    }

    const apiKey = resolveWebhookApiKey(req)
    const authContext = await validateApiKey(apiKey)
    if (!authContext) {
      return apiError(
        'Valid FixFlags API key required. Add ?apiKey=ff_live_... to the Railway webhook URL.',
        401
      )
    }

    const outcome = await checkAndPlan({
      url: checkUrl,
      userId: authContext.user.id,
      auditMode: 'CRITICAL_PATH',
      waitForCompletion: false,
    })
    const deployment = railwayDeploymentReference(payload)
    await recordProductReleaseForReview({
      auditId: outcome.reportId,
      source: 'railway',
      externalId: deployment.externalId,
      commitRef: deployment.commitRef,
      url: checkUrl,
    })

    logger.info('railway deployment check enqueued', {
      reportId: outcome.reportId,
      url: checkUrl,
      eventType: payload.type,
    })

    return NextResponse.json({
      ok: true,
      reportId: outcome.reportId,
      reportUrl: outcome.reportUrl,
      status: outcome.status,
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
