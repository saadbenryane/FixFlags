import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { cn, gradeColor, areaLabel } from '@/lib/utils'

const AREA_ORDER = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE']

const SAMPLES = [
  {
    url: 'https://stripe.com',
    pageJob: 'Convert developers and businesses into Stripe payment platform customers',
    score: 91,
    verdict: 'Exceptional quality across all areas. Industry benchmark for developer-focused SaaS.',
    areas: [
      { name: 'PERFORMANCE', grade: 'A', score: 94 },
      { name: 'ACCESSIBILITY', grade: 'A', score: 97 },
      { name: 'SEO', grade: 'A', score: 98 },
      { name: 'CONVERSION', grade: 'A', score: null },
      { name: 'TRUST', grade: 'A', score: null },
      { name: 'CONTENT', grade: 'A', score: null },
      { name: 'MOBILE', grade: 'A', score: 92 },
    ],
    topFindings: [
      { area: 'PERFORMANCE', severity: 'LOW', problem: '3 third-party scripts add ~80ms render delay' },
      { area: 'CONTENT', severity: 'INFO', problem: 'Navigation has 22 items — could be simplified for new visitors' },
    ],
  },
  {
    url: 'https://linear.app',
    pageJob: 'Convert software teams into Linear project management tool subscribers',
    score: 78,
    verdict: 'Strong design and content, but mobile performance and SEO structured data need attention.',
    areas: [
      { name: 'PERFORMANCE', grade: 'B', score: 82 },
      { name: 'ACCESSIBILITY', grade: 'B', score: 88 },
      { name: 'SEO', grade: 'C', score: 64 },
      { name: 'CONVERSION', grade: 'A', score: null },
      { name: 'TRUST', grade: 'B', score: null },
      { name: 'CONTENT', grade: 'A', score: null },
      { name: 'MOBILE', grade: 'C', score: 61 },
    ],
    topFindings: [
      { area: 'SEO', severity: 'HIGH', problem: 'No structured data (Organization/SoftwareApplication schema) — missing rich snippets' },
      { area: 'MOBILE', severity: 'HIGH', problem: 'Mobile LCP is 3.8s — hero video loads before text content' },
      { area: 'ACCESSIBILITY', severity: 'MEDIUM', problem: '4 icon-only buttons missing aria-labels in the main nav' },
    ],
  },
  {
    url: 'https://cal.com',
    pageJob: 'Convert scheduling-tool users into Cal.com open-source subscribers',
    score: 63,
    verdict: 'Good conversion intent but multiple SEO and performance issues are limiting organic reach.',
    areas: [
      { name: 'PERFORMANCE', grade: 'C', score: 58 },
      { name: 'ACCESSIBILITY', grade: 'C', score: 71 },
      { name: 'SEO', grade: 'B', score: 79 },
      { name: 'CONVERSION', grade: 'B', score: null },
      { name: 'TRUST', grade: 'A', score: null },
      { name: 'CONTENT', grade: 'C', score: null },
      { name: 'MOBILE', grade: 'D', score: 43 },
    ],
    topFindings: [
      { area: 'MOBILE', severity: 'CRITICAL', problem: 'Mobile PageSpeed score 43 — primary CTA below fold on 375px' },
      { area: 'PERFORMANCE', severity: 'HIGH', problem: '460KB unused JavaScript — consider code splitting for above-fold content' },
      { area: 'ACCESSIBILITY', severity: 'HIGH', problem: '11 images missing alt text in the integration logos section' },
      { area: 'CONTENT', severity: 'MEDIUM', problem: 'Hero headline "The scheduling infrastructure for everyone" is generic — no specific outcome stated' },
    ],
  },
]

const severityColor: Record<string, string> = {
  CRITICAL: 'text-red-700 bg-red-100',
  HIGH: 'text-orange-700 bg-orange-100',
  MEDIUM: 'text-yellow-700 bg-yellow-100',
  LOW: 'text-blue-700 bg-blue-100',
  INFO: 'text-gray-700 bg-gray-100',
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 90 ? 'text-green-600' : score >= 75 ? 'text-lime-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'
  return (
    <div className={cn('text-3xl font-bold tabular-nums', color)}>{score}<span className="text-base font-normal text-muted-foreground">/100</span></div>
  )
}

export default function SamplesPage() {
  return (
    <div className="min-h-screen">
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">QualityOS</Link>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
          <Link href="/sign-in" className="text-sm font-medium text-primary hover:underline">Sign in</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Sample audit reports</h1>
          <p className="text-muted-foreground">
            See what QualityOS finds. These are representative examples of the 7-area quality analysis.
          </p>
        </div>

        {SAMPLES.map((sample) => (
          <Card key={sample.url} className="overflow-hidden">
            <CardHeader className="bg-muted/20 border-b pb-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-mono">{sample.url}</div>
                  <div className="text-sm font-medium max-w-xl">{sample.pageJob}</div>
                </div>
                <ScoreRing score={sample.score} />
              </div>
              <p className="text-sm text-muted-foreground mt-2">{sample.verdict}</p>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Area grades */}
              <div className="flex flex-wrap gap-2">
                {AREA_ORDER.map((name) => {
                  const area = sample.areas.find((a) => a.name === name)
                  if (!area) return null
                  return (
                    <div key={name} className={cn('rounded-lg border px-2.5 py-1.5 text-center min-w-[52px]', gradeColor(area.grade))}>
                      <div className="text-sm font-bold leading-none">{area.grade}</div>
                      {area.score !== null && <div className="text-xs mt-0.5 opacity-70">{area.score}</div>}
                      <div className="text-xs mt-0.5 opacity-60">{areaLabel(name).slice(0, 4)}</div>
                    </div>
                  )
                })}
              </div>

              {/* Top findings */}
              <div className="space-y-2">
                {sample.topFindings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2">
                    <Badge className={cn('text-xs shrink-0 mt-0.5', severityColor[f.severity])}>{f.severity}</Badge>
                    <span className="text-xs text-muted-foreground w-20 shrink-0 pt-0.5">{areaLabel(f.area)}</span>
                    <span className="text-sm">{f.problem}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                Each finding includes a copy-ready fix prompt for Cursor, Claude Code, Lovable, and Bolt.
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="text-center space-y-4 py-8">
          <h2 className="text-xl font-semibold">Audit your site now</h2>
          <p className="text-muted-foreground">Free — no account needed. Takes under 60 seconds.</p>
          <Button asChild size="lg">
            <Link href="/">
              Start auditing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <footer className="border-t px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
        <span>© 2026 QualityOS</span>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/docs/mcp" className="hover:text-foreground">MCP Docs</Link>
        </div>
      </footer>
    </div>
  )
}
