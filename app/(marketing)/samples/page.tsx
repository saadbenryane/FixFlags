import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { CoverOverlay } from '@/components/ui/cover-overlay'
import { ArticleCTA } from '@/components/ui/article-cta'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { ArrowRight } from 'lucide-react'
import { cn, gradeColor, areaLabel } from '@/lib/utils'
import { SAMPLES_PAGE } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('samples', '/samples')

const AREA_ORDER = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE']

const SAMPLES = [
  {
    url: 'https://stripe.com',
    screenshotUrl: 'https://image.thum.io/get/width/1200/crop/800/https://stripe.com',
    pageJob: 'Convert developers and businesses into Stripe payment platform customers',
    score: 91,
    verdict: 'Strong across all seven areas. A useful benchmark for developer-focused SaaS.',
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
      { area: 'CONTENT', severity: 'INFO', problem: 'Navigation has 22 items. Could be simplified for new visitors.' },
    ],
  },
  {
    url: 'https://linear.app',
    screenshotUrl: 'https://image.thum.io/get/width/1200/crop/800/https://linear.app',
    pageJob: 'Convert software teams into Linear project management tool subscribers',
    score: 78,
    verdict: 'Strong design and content. Mobile performance and SEO structured data need attention.',
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
      { area: 'SEO', severity: 'HIGH', problem: 'No structured data (Organization/SoftwareApplication schema). Missing rich snippets.' },
      { area: 'MOBILE', severity: 'HIGH', problem: 'Mobile LCP is 3.8s. Hero video loads before text content.' },
      { area: 'ACCESSIBILITY', severity: 'MEDIUM', problem: '4 icon-only buttons missing aria-labels in the main nav' },
    ],
  },
  {
    url: 'https://cal.com',
    screenshotUrl: 'https://image.thum.io/get/width/1200/crop/800/https://cal.com',
    pageJob: 'Convert scheduling-tool users into Cal.com open-source subscribers',
    score: 63,
    verdict: 'Good conversion intent. SEO and performance issues are limiting organic reach.',
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
      { area: 'MOBILE', severity: 'CRITICAL', problem: 'Mobile PageSpeed score 43. Primary CTA below fold on 375px.' },
      { area: 'PERFORMANCE', severity: 'HIGH', problem: '460KB unused JavaScript. Consider code splitting for above-fold content.' },
      { area: 'ACCESSIBILITY', severity: 'HIGH', problem: '11 images missing alt text in the integration logos section' },
      { area: 'CONTENT', severity: 'MEDIUM', problem: 'Hero headline is generic. No specific outcome stated.' },
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
  const color =
    score >= 90
      ? 'text-green-600'
      : score >= 75
        ? 'text-lime-600'
        : score >= 50
          ? 'text-yellow-600'
          : 'text-red-600'
  return (
    <div className={cn('text-3xl font-bold tabular-nums', color)}>
      {score}
      <span className="text-base font-normal text-muted-foreground">/100</span>
    </div>
  )
}

export default function SamplesPage() {
  return (
    <Section spacing="default">
      <Container className="max-w-4xl space-y-12">
        <div className="space-y-3">
          <Heading as="h1">{SAMPLES_PAGE.headline}</Heading>
          <Body className="text-muted-foreground">{SAMPLES_PAGE.subhead}</Body>
        </div>

        {SAMPLES.map((sample) => (
          <div key={sample.url} className="space-y-4">
            <CoverOverlay
              imageSrc={sample.screenshotUrl}
              imageAlt={`Screenshot of ${sample.url}`}
              title={new URL(sample.url).hostname.replace('www.', '')}
              subtitle={sample.pageJob}
              interactive={false}
            />

            <Card className="overflow-hidden">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-mono">{sample.url}</div>
                    <p className="text-sm text-muted-foreground">{sample.verdict}</p>
                  </div>
                  <ScoreRing score={sample.score} />
                </div>

                <div className="flex flex-wrap gap-2">
                  {AREA_ORDER.map((name) => {
                    const area = sample.areas.find((a) => a.name === name)
                    if (!area) return null
                    return (
                      <div
                        key={name}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-center min-w-[52px]',
                          gradeColor(area.grade)
                        )}
                      >
                        <div className="text-sm font-bold leading-none">{area.grade}</div>
                        {area.score !== null && (
                          <div className="text-xs mt-0.5 opacity-70">{area.score}</div>
                        )}
                        <div className="text-xs mt-0.5 opacity-60">{areaLabel(name).slice(0, 4)}</div>
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-2">
                  {sample.topFindings.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2">
                      <Badge className={cn('text-xs shrink-0 mt-0.5', severityColor[f.severity])}>
                        {f.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground w-14 shrink-0 pt-0.5">
                        {areaLabel(f.area)}
                      </span>
                      <span className="text-sm">{f.problem}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs text-muted-foreground">{SAMPLES_PAGE.findingsFooter}</div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/">
                      {SAMPLES_PAGE.cardCta}
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}

        <ArticleCTA
          headline="Run the same audit on your site"
          body="Paste a URL. Get graded findings across seven areas and copy-ready fix prompts for your agent."
          buttonLabel={SAMPLES_PAGE.bottomCta}
          buttonHref="/"
        />
      </Container>
    </Section>
  )
}
