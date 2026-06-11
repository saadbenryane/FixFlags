import { AuditInput } from '@/components/audit/AuditInput'
import { FaqSection } from '@/components/marketing/FaqSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { GlassCard } from '@/components/ui/glass-card'
import { Section } from '@/components/ui/section'
import { Body, Heading, Muted } from '@/components/ui/typography'
import {
  BRAND,
  HERO,
  SAMPLE_FINDINGS,
  SAMPLE_FINDINGS_FOOTER,
  WORKFLOW_STEPS,
  PROBLEM_SECTION,
  DIFFERENTIATION,
  SOCIAL_PROOF,
  QUALITY_AREAS,
  MCP_SECTION,
  PRICING_TEASER,
  FINAL_CTA,
  FAQ,
} from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import {
  ArrowRight,
  CheckCircle2,
  Zap,
  AlertTriangle,
  Search,
  TrendingDown,
  Plug,
} from 'lucide-react'
import Link from 'next/link'

export const metadata = buildPageMetadata('home', '/')

const PAIN_ICONS = [AlertTriangle, Search, TrendingDown]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <Section spacing="loose" className="flex flex-col items-center text-center space-y-8">
        <Container className="flex flex-col items-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border overlay-pill-glass px-3 py-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            {BRAND.tribeBadge}
          </div>

          <div className="space-y-4 max-w-3xl">
            <Heading as="h1">
              {HERO.headline}{' '}
              <span className="text-primary">{HERO.headlineAccent}</span>
            </Heading>
            <Body className="max-w-2xl mx-auto text-muted-foreground">{HERO.subhead}</Body>
          </div>

          <AuditInput />

          <Muted>{HERO.trustLine}</Muted>

          <Button variant="outline" size="sm" asChild>
            <Link href="/samples">
              {HERO.secondaryCta}
              <ArrowRight className="ml-2 h-3 w-3" />
            </Link>
          </Button>

          {/* Sample findings teaser */}
          <GlassCard variant="medium" className="w-full max-w-lg mt-4 overflow-hidden p-0">
            <div className="border-b px-4 py-3 bg-muted/30 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-xs text-muted-foreground ml-2">Sample audit results</span>
            </div>
            <div className="divide-y">
              {SAMPLE_FINDINGS.map((f) => (
                <div key={f.issue} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`text-sm font-bold w-6 text-center rounded ${
                      f.grade === 'D'
                        ? 'text-orange-600'
                        : f.grade === 'C'
                          ? 'text-yellow-600'
                          : 'text-lime-600'
                    }`}
                  >
                    {f.grade}
                  </span>
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{f.area}</span>
                  <span className="text-sm">{f.issue}</span>
                </div>
              ))}
            </div>
            <div className="border-t px-4 py-3 bg-muted/20 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground">{SAMPLE_FINDINGS_FOOTER}</span>
            </div>
          </GlassCard>
        </Container>
      </Section>

      {/* Workflow */}
      <Section spacing="default" className="bg-muted/20">
        <Container className="space-y-10">
          <Heading as="h2" className="text-center">
            How it works
          </Heading>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.step} className="space-y-2 text-center">
                <div className="mx-auto w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {step.step}
                </div>
                <div className="font-semibold">{step.title}</div>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Problem */}
      <Section spacing="default">
        <Container className="space-y-10">
          <Heading as="h2" className="text-center">
            {PROBLEM_SECTION.headline}
          </Heading>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {PROBLEM_SECTION.pains.map((pain, i) => {
              const Icon = PAIN_ICONS[i]
              return (
                <Card key={pain.title}>
                  <CardContent className="pt-6 space-y-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <div className="font-semibold">{pain.title}</div>
                    <p className="text-sm text-muted-foreground">{pain.body}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </Container>
      </Section>

      {/* Differentiation */}
      <Section spacing="default" className="bg-muted/20">
        <Container className="space-y-8">
          <Heading as="h2" className="text-center">
            {DIFFERENTIATION.headline}
          </Heading>
          <div className="overflow-x-auto rounded-card border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-4 font-medium" />
                  <th className="p-4 font-medium text-muted-foreground">PageSpeed / Lighthouse</th>
                  <th className="p-4 font-medium text-muted-foreground">Manual QA</th>
                  <th className="p-4 font-medium text-primary">{BRAND.name}</th>
                </tr>
              </thead>
              <tbody>
                {DIFFERENTIATION.rows.map((row) => (
                  <tr key={row.feature} className="border-b last:border-0">
                    <td className="p-4 font-medium">{row.feature}</td>
                    <td className="p-4 text-center text-muted-foreground">{row.lighthouse}</td>
                    <td className="p-4 text-center text-muted-foreground">{row.manual}</td>
                    <td className="p-4 text-center font-medium text-primary">{row.qualityos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      {/* Social proof */}
      <Section spacing="default">
        <Container className="space-y-8">
          <Heading as="h2" className="text-center">
            {SOCIAL_PROOF.headline}
          </Heading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SOCIAL_PROOF.samples.map((sample) => (
              <Card key={sample.name} interactive>
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{sample.name}</span>
                    <span className="text-2xl font-bold text-primary">{sample.score}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{sample.finding}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <Button variant="outline" asChild>
              <Link href="/samples">
                View full sample reports
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>

      {/* 7 Quality Areas */}
      <Section spacing="default" className="bg-muted/20">
        <Container className="space-y-8">
          <Heading as="h2" className="text-center">
            7 quality areas that matter at launch
          </Heading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QUALITY_AREAS.map((area) => (
              <div key={area.name} className="rounded-lg border bg-card p-4 space-y-1 shadow-sm">
                <div className="font-semibold">{area.name}</div>
                <p className="text-sm text-muted-foreground">{area.impact}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* MCP */}
      <Section spacing="default">
        <Container className="max-w-3xl space-y-6">
          <div className="flex items-center gap-3 justify-center">
            <Plug className="h-6 w-6 text-primary" />
            <Heading as="h2">{MCP_SECTION.headline}</Heading>
          </div>
          <Body className="text-center text-muted-foreground">{MCP_SECTION.body}</Body>
          <Card>
            <CardContent className="pt-6">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                {MCP_SECTION.workflow}
              </pre>
            </CardContent>
          </Card>
          <div className="text-center">
            <Button asChild>
              <Link href="/docs/mcp">
                {MCP_SECTION.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>

      {/* Pricing teaser */}
      <Section spacing="default" className="bg-muted/20">
        <Container className="space-y-8">
          <Heading as="h2" className="text-center">
            {PRICING_TEASER.headline}
          </Heading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PRICING_TEASER.plans.map((plan) => (
              <Card
                key={plan.name}
                interactive
                className={plan.name === 'Builder' ? 'border-primary ring-2 ring-primary/20' : ''}
              >
                <CardContent className="pt-6 space-y-2 text-center">
                  <div className="font-semibold">{plan.name}</div>
                  <div className="text-2xl font-bold">{plan.price}</div>
                  <p className="text-sm text-muted-foreground">{plan.outcome}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <Button variant="outline" asChild>
              <Link href="/pricing">
                {PRICING_TEASER.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>

      {/* FAQ */}
      <Section spacing="default">
        <Container className="max-w-2xl">
          <FaqSection items={FAQ} />
          <div className="text-center mt-6">
            <Link href="/faq" className="text-sm text-primary link-underline-grow">
              View all questions
            </Link>
          </div>
        </Container>
      </Section>

      {/* Final CTA */}
      <Section spacing="loose" className="bg-muted/20">
        <Container className="max-w-3xl text-center space-y-6">
          <Heading as="h2">{FINAL_CTA.headline}</Heading>
          <AuditInput />
          <Muted>{FINAL_CTA.trustLine}</Muted>
        </Container>
      </Section>
    </>
  )
}
