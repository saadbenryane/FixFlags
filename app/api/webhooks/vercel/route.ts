import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAndPlan } from '@/lib/audit/task-contracts'
import { validateApiKey } from '@/lib/mcp/tools'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'
import { createHmac, timingSafeEqual } from 'node:crypto'

const deploymentSchema = z.object({
  type: z.literal('deployment.succeeded'),
  payload: z.object({
    deployment: z.object({
      url: z.string().url(),
    }),
    target: z.enum(['production', 'preview']).optional(),
  }),
})

function verifyVercelSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith('sha1=')) return false
  const digest = createHmac('sha1', secret).update(rawBody).digest('hex')
  const expected = `sha1=${digest}`
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

function resolveWebhookApiKey(req: NextRequest): string | null {
  const fromQuery = req.nextUrl.searchParams.get('apiKey')
  if (fromQuery?.trim()) return fromQuery.trim()
  const fromHeader = req.headers.get('x-fixflags-api-key')
  return fromHeader?.trim() || null
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.VERCEL_WEBHOOK_SECRET
    if (!secret) return apiError('Vercel webhook not configured', 503)

    const rawBody = await req.text()
    const signature = req.headers.get('x-vercel-signature')
    if (!verifyVercelSignature(rawBody, signature, secret)) {
      return apiError('Invalid signature', 401)
    }

    const parsed = deploymentSchema.safeParse(JSON.parse(rawBody))
    if (!parsed.success) {
      return NextResponse.json({ ok: true, skipped: 'ignored_event' })
    }

    const url = parsed.data.payload.deployment.url
    const apiKey = resolveWebhookApiKey(req)
    const user = await validateApiKey(apiKey)
    if (!user) {
      return apiError(
        'Valid FixFlags API key required. Add ?apiKey=ff_live_... to the webhook URL in Vercel.',
        401
      )
    }

    const outcome = await checkAndPlan({
      url,
      userId: user.id,
      auditMode: 'CRITICAL_PATH',
      waitForCompletion: false,
    })

    logger.info('vercel deployment check enqueued', {
      reportId: outcome.reportId,
      url,
      target: parsed.data.payload.target,
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
