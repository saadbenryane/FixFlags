import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'

const querySchema = z.object({
  auditId: z.string().min(1),
  page: z.string().optional(),
})

type RumMetric = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
const ALL_METRICS: RumMetric[] = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB']

interface MetricPercentiles {
  p50: number | null
  p75: number | null
  p95: number | null
  sampleCount: number
  rating: string | null
}

async function computePercentiles(
  values: number[]
): Promise<{ p50: number | null; p75: number | null; p95: number | null }> {
  if (values.length === 0) return { p50: null, p75: null, p95: null }
  const sorted = [...values].sort((a, b) => a - b)
  const percentile = (p: number) => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
  }
  return { p50: percentile(50), p75: percentile(75), p95: percentile(95) }
}

export async function GET(request: NextRequest) {
  try {
    const clientId = requestClientId(request.headers)
    const rate = await recordRateLimit({
      scope: 'rum_summary',
      identifier: clientId,
      limit: 30,
      windowSeconds: 60,
    })
    if (rate.exceeded) {
      return apiError('Too many requests', 429, { code: 'RATE_LIMITED' })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      auditId: searchParams.get('auditId'),
      page: searchParams.get('page') || undefined,
    })
    if (!parsed.success) {
      return apiError('auditId is required', 400)
    }

    const { auditId, page } = parsed.data

    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { siteId: true, normalizedDomain: true },
    })
    const siteId = audit?.siteId || audit?.normalizedDomain
    if (!siteId) {
      return NextResponse.json({ metrics: {} })
    }

    const pageFilter = page || '/'

    const metrics: Record<string, MetricPercentiles> = {}

    for (const metric of ALL_METRICS) {
      const rows = await prisma.rumMeasurement.findMany({
        where: { siteId, metric, page: pageFilter },
        select: { value: true, rating: true },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      })

      const values = rows.map((r) => r.value)
      const percentiles = await computePercentiles(values)
      const rating = rows[0]?.rating || null

      metrics[metric] = {
        ...percentiles,
        sampleCount: rows.length,
        rating,
      }
    }

    return NextResponse.json({ metrics })
  } catch (err) {
    return handleRouteError(err)
  }
}
