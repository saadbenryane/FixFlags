'use client'

import { useEffect, useState } from 'react'
import { Surface } from '@/components/ui/surface'
import { Badge } from '@/components/ui/badge'
import { SectionTitle, Muted, LabelCaps } from '@/components/ui/typography'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface MetricPercentiles {
  p50: number | null
  p75: number | null
  p95: number | null
  sampleCount: number
  rating: RumRating | null
}

type RumMetric = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
type RumRating = 'good' | 'needs-improvement' | 'poor'

interface RumSummary {
  metrics: Record<RumMetric, MetricPercentiles>
}

interface RumMetricsSectionProps {
  auditId: string
  siteId?: string | null
  pageUrl?: string
}

const METRIC_LABELS: Record<RumMetric, string> = {
  LCP: 'Largest Contentful Paint',
  CLS: 'Cumulative Layout Shift',
  INP: 'Interaction to Next Paint',
  FCP: 'First Contentful Paint',
  TTFB: 'Time to First Byte',
}

const METRIC_UNITS: Record<RumMetric, string> = {
  LCP: 'ms',
  CLS: '',
  INP: 'ms',
  FCP: 'ms',
  TTFB: 'ms',
}

function ratingBadge(rating: RumRating | null) {
  if (!rating) return null
  const styles: Record<RumRating, string> = {
    good: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    'needs-improvement': 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    poor: 'bg-red-500/15 text-red-600 border-red-500/30',
  }
  const labels: Record<RumRating, string> = {
    good: 'Good',
    'needs-improvement': 'Needs work',
    poor: 'Poor',
  }
  return (
    <Badge variant="outline" size="sm" className={cn('ml-2', styles[rating])}>
      {labels[rating]}
    </Badge>
  )
}

function formatValue(metric: RumMetric, value: number): string {
  if (metric === 'CLS') return value.toFixed(3)
  return Math.round(value).toLocaleString()
}

async function fetchRumSummary(
  auditId: string,
  pageUrl?: string
): Promise<RumSummary> {
  const params = new URLSearchParams({ auditId })
  if (pageUrl) params.set('page', pageUrl)
  const res = await fetch(`/api/rum/summary?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch RUM summary')
  return res.json()
}

export function RumMetricsSection({ auditId, pageUrl }: RumMetricsSectionProps) {
  const [summary, setSummary] = useState<RumSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchRumSummary(auditId, pageUrl)
      .then((data) => {
        if (!cancelled) {
          setSummary(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load metrics')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [auditId, pageUrl])

  if (loading) {
    return (
      <Surface variant="elevated">
        <SectionTitle className="mb-4">Real User Metrics</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </Surface>
    )
  }

  if (error || !summary) {
    return null
  }

  const hasAnyData = Object.values(summary.metrics).some((m) => m.sampleCount > 0)
  if (!hasAnyData) {
    return null
  }

  const orderedMetrics: RumMetric[] = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB']

  return (
    <Surface variant="elevated">
      <SectionTitle className="mb-1">Real User Metrics</SectionTitle>
      <Muted className="mb-5 text-xs">
        Measured from {orderedMetrics.reduce((max, m) => Math.max(max, summary.metrics[m].sampleCount), 0)} real page loads.
      </Muted>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {orderedMetrics.map((metric) => {
          const m = summary.metrics[metric]
          if (m.sampleCount === 0) return null
          const unit = METRIC_UNITS[metric]
          return (
            <div key={metric} className="space-y-1.5">
              <div className="flex items-center">
                <LabelCaps>{metric}</LabelCaps>
                {ratingBadge(m.rating)}
              </div>
              <div className="text-xl font-semibold tabular-nums tracking-tight">
                {m.p50 !== null ? formatValue(metric, m.p50) : '--'}
                {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                {m.p75 !== null && (
                  <span>
                    p75{' '}
                    <span className="tabular-nums text-foreground font-medium">
                      {formatValue(metric, m.p75)}
                      {unit}
                    </span>
                  </span>
                )}
                {m.p95 !== null && (
                  <span>
                    p95{' '}
                    <span className="tabular-nums text-foreground font-medium">
                      {formatValue(metric, m.p95)}
                      {unit}
                    </span>
                  </span>
                )}
              </div>
              <Muted className="!text-2xs">{METRIC_LABELS[metric]}</Muted>
            </div>
          )
        })}
      </div>
    </Surface>
  )
}
