'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROAST_COPY } from '@/lib/marketing/copy'

interface RubricResult {
  name: string
  score: number
  grade: string
  verdict: string
}

interface RoastData {
  url: string
  auditId?: string
  reportUrl?: string
  overallGrade: string
  overallScore: number
  tagline: string
  rubrics: RubricResult[]
  topIssues: {
    severity: string
    problem: string
    rubric: string
  }[]
  badgeSvg: string
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-grade-A',
  B: 'text-grade-B',
  C: 'text-grade-C',
  D: 'text-grade-D',
  F: 'text-grade-F',
}

const GRADE_BG: Record<string, string> = {
  A: 'bg-grade-A/10 border-grade-A/30',
  B: 'bg-grade-B/10 border-grade-B/30',
  C: 'bg-grade-C/10 border-grade-C/30',
  D: 'bg-grade-D/10 border-grade-D/30',
  F: 'bg-grade-F/10 border-grade-F/30',
}

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-destructive/10 text-destructive border-destructive/30',
  IMPORTANT: 'bg-grade-D/10 text-grade-D border-grade-D/30',
  POLISH: 'bg-grade-C/10 text-grade-C border-grade-C/30',
}

export function RoastClient() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RoastData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRoast() {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    const targetUrl = url.startsWith('http') ? url : `https://${url}`

    try {
      const res = await fetch('/api/tools/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message || data?.error || 'Roast failed')
      }

      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function downloadBadge() {
    if (!result) return
    const blob = new Blob([result.badgeSvg], { type: 'image/svg+xml' })
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `fixflags-badge-${result.overallGrade}.svg`
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  function copyBadgeMarkdown() {
    if (!result) return
    const badgeUrl = `https://fixflags.com/api/badge/${encodeURIComponent(result.url)}`
    const markdown = `![FixFlags Quality](${badgeUrl})`
    navigator.clipboard.writeText(markdown)
  }

  const reportHref =
    result?.reportUrl || (result?.auditId ? `/report/${result.auditId}` : null)

  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <h1 className="font-display text-3xl font-medium tracking-display sm:text-4xl">
          {ROAST_COPY.title}
        </h1>
        <p className="text-muted-foreground">{ROAST_COPY.subhead}</p>
      </div>

      <div className="flex gap-2">
        <Input
          type="url"
          placeholder={ROAST_COPY.placeholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRoast()}
          className="flex-1"
          disabled={loading}
        />
        <Button onClick={handleRoast} disabled={loading || !url.trim()} variant="default">
          {loading ? ROAST_COPY.ctaLoading : ROAST_COPY.cta}
        </Button>
      </div>

      {error && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div
            className={cn('rounded-card border p-8 text-center', GRADE_BG[result.overallGrade])}
          >
            <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {ROAST_COPY.overallLabel}
            </p>
            <p
              className={cn(
                'mt-2 font-display text-7xl font-bold',
                GRADE_COLORS[result.overallGrade]
              )}
            >
              {result.overallGrade}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-foreground">
              {result.overallGrade}
            </p>
            <p className="mt-3 text-muted-foreground">{result.tagline}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {result.rubrics.map((rubric) => (
              <div
                key={rubric.name}
                className={cn('rounded-card border p-4', GRADE_BG[rubric.grade])}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{rubric.name}</span>
                  <span className={cn('font-display text-2xl font-bold', GRADE_COLORS[rubric.grade])}>
                    {rubric.grade}
                  </span>
                </div>
                <p className="mt-1 font-display text-3xl font-semibold text-foreground">
                  {rubric.score}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{rubric.verdict}</p>
              </div>
            ))}
          </div>

          {result.topIssues.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display text-lg font-medium">{ROAST_COPY.topIssuesHeading}</h3>
              <div className="space-y-2">
                {result.topIssues.map((issue, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-card border border-border/50 p-3"
                  >
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs font-medium',
                        SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.POLISH
                      )}
                    >
                      {issue.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{issue.problem}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{issue.rubric}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-4 rounded-card border border-border/50 p-6">
            <p className="text-sm font-medium text-muted-foreground">{ROAST_COPY.shareBadge}</p>
            <div
              className="overflow-hidden rounded-card"
              dangerouslySetInnerHTML={{ __html: result.badgeSvg }}
            />
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadBadge}>
                {ROAST_COPY.downloadSvg}
              </Button>
              <Button variant="outline" size="sm" onClick={copyBadgeMarkdown}>
                {ROAST_COPY.copyMarkdown}
              </Button>
              {reportHref ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(reportHref, '_blank')}
                >
                  {ROAST_COPY.fullReport}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">{ROAST_COPY.wantFixes}</p>
            <Button
              variant="default"
              className="mt-2"
              onClick={() => window.location.assign('/#audit')}
            >
              {ROAST_COPY.runFullAudit}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
