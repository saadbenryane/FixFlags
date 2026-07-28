import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'

const rumSchema = z.object({
  siteId: z.string().min(1).max(200),
  page: z.string().max(2000).default('/'),
  metric: z.enum(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']),
  value: z.number().finite(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  delta: z.number().finite().optional(),
  nav: z.number().int().min(-1).max(3).optional(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function POST(request: Request) {
  try {
    const clientId = requestClientId(request.headers)
    const rate = await recordRateLimit({
      scope: 'rum_collect',
      identifier: clientId,
      limit: 300,
      windowSeconds: 60,
    })
    if (rate.exceeded) {
      return new Response(null, { status: 429, headers: corsHeaders })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response(null, { status: 400, headers: corsHeaders })
    }

    const parsed = rumSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(null, { status: 400, headers: corsHeaders })
    }

    const { siteId, page, metric, value, rating, delta, nav } = parsed.data

    const siteRate = await recordRateLimit({
      scope: 'rum_collect_site',
      identifier: siteId,
      limit: 600,
      windowSeconds: 60,
    })
    if (siteRate.exceeded) {
      return new Response(null, { status: 429, headers: corsHeaders })
    }

    prisma.rumMeasurement
      .create({ data: { siteId, page, metric, value, rating, delta, nav } })
      .catch((err) => {
        logger.warn(
          'Failed to persist RUM measurement',
          err instanceof Error ? err.message : String(err)
        )
      })

    return new Response(null, { status: 204, headers: corsHeaders })
  } catch (err) {
    logger.error(
      'RUM collect error',
      err instanceof Error ? err : new Error(String(err))
    )
    return new Response(null, { status: 500, headers: corsHeaders })
  }
}
