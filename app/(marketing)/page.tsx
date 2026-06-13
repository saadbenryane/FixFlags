import { FaqSection } from '@/components/marketing/FaqSection'
import { HeroSection } from '@/components/marketing/HeroSection'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { AuditCtaBlock } from '@/components/marketing/AuditCtaBlock'
import { ComparisonTable } from '@/components/marketing/ComparisonTable'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import {
  WORKFLOW_SECTION,
  WORKFLOW_STEPS,
  PROBLEM_SECTION,
  DIFFERENTIATION,
  SOCIAL_PROOF,
  QUALITY_AREAS_SECTION,
  QUALITY_AREAS,
  MCP_SECTION,
  PRICING_TEASER,
  MID_CTA,
  FINAL_CTA,
  HOME_FAQ,
  FAQ_SECTION,
} from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import {
  ArrowRight,
  AlertTriangle,
  Search,
  TrendingDown,
  Plug,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata = buildPageMetadata('home', '/')

const PAIN_ICONS = [AlertTriangle, Search, TrendingDown]

export default function HomePage() {
  return (
    <>
      <HeroSection />

      {/* Problem */}
      <Section spacing="default">
        <Container className="space-y-12">
          <SectionIntro label="The gap" headline={PROBLEM_SECTION.headline} />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {PROBLEM_SECTION.pains.map((pain, i) => {
              const Icon = PAIN_ICONS[i]
              return (
                <div
                  key={pain.title}
                  className="marketing-panel group relative overflow-hidden p-6 transition-shadow duration-300 hover:shadow-card-hover"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand/80 to-brand/20" />
                  <Icon className="mb-4 h-5 w-5 text-brand" />
                  <h3 className="text-lg font-semibold tracking-tight">{pain.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pain.body}</p>
                </div>
              )
            })}
          </div>
        </Container>
      </Section>

      {/* How it works */}
      <Section spacing="default" className="border-y border-border/60 bg-muted/30">
        <Container className="space-y-12">
          <SectionIntro label="Workflow" headline={WORKFLOW_SECTION.headline} />
          <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div
              aria-hidden
              className="absolute left-[12.5%] right-[12.5%] top-4 hidden h-px bg-border lg:block"
            />
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.step} className="relative space-y-3 text-center">
                <div className="relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background font-mono text-sm font-semibold shadow-sm">
                  {step.step}
                </div>
                <div className="font-semibold">{step.title}</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Differentiation */}
      <Section spacing="default">
        <Container className="space-y-10">
          <SectionIntro label="Why us" headline={DIFFERENTIATION.headline} />
          <ComparisonTable rows={DIFFERENTIATION.rows} />
        </Container>
      </Section>

      {/* Social proof */}
      <Section spacing="default" className="bg-muted/30">
        <Container className="space-y-8">
          <SectionIntro label="Proof" headline={SOCIAL_PROOF.headline} />
          <div className="mx-auto max-w-lg">
            <Card interactive className="overflow-hidden border-border/60 shadow-card">
              <CardContent className="space-y-4 p-0">
                <div className="rounded-nested-top-md flex items-center justify-between border-b bg-muted/30 px-6 py-4">
                  <span className="font-semibold">{SOCIAL_PROOF.sample.name}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-bold tabular-nums text-brand">
                      {SOCIAL_PROOF.sample.score}
                    </span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </div>
                <p className="px-6 pb-6 text-sm leading-relaxed text-muted-foreground">
                  {SOCIAL_PROOF.sample.finding}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="text-center">
            <Button variant="outline" asChild>
              <Link href="/samples">
                {SOCIAL_PROOF.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>

      {/* Mid-page CTA */}
      <Section spacing="default">
        <Container>
          <AuditCtaBlock headline={MID_CTA.headline} trustLine={MID_CTA.trustLine} />
        </Container>
      </Section>

      {/* Quality areas */}
      <Section spacing="default" className="border-y border-border/60 bg-muted/20">
        <Container className="space-y-10">
          <SectionIntro label="Coverage" headline={QUALITY_AREAS_SECTION.headline} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QUALITY_AREAS.map((area, i) => (
              <div
                key={area.name}
                className={cn(
                  'marketing-panel flex gap-4 p-5',
                  i % 2 === 1 && 'sm:translate-y-3'
                )}
              >
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="space-y-1">
                  <div className="font-semibold">{area.name}</div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{area.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* MCP */}
      <Section spacing="default">
        <Container className="max-w-3xl space-y-8">
          <div className="space-y-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <Plug className="h-5 w-5 text-brand" />
              <p className="section-label">MCP integration</p>
            </div>
            <Heading as="h2">{MCP_SECTION.headline}</Heading>
            <Body className="text-muted-foreground">{MCP_SECTION.body}</Body>
          </div>
          <TerminalBlock label="Agent workflow">{MCP_SECTION.workflow}</TerminalBlock>
          <div className="text-center">
            <Button variant="outline" asChild>
              <Link href="/docs/mcp">
                {MCP_SECTION.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>

      {/* Pricing teaser */}
      <Section spacing="default" className="bg-muted/30">
        <Container className="space-y-10">
          <SectionIntro label="Pricing" headline={PRICING_TEASER.headline} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PRICING_TEASER.plans.map((plan) => {
              const highlighted = plan.name === 'Builder'
              return (
                <Card
                  key={plan.name}
                  interactive
                  className={cn(
                    'relative text-center transition-shadow',
                    highlighted &&
                      'border-brand/40 shadow-card-hover ring-1 ring-brand/20'
                  )}
                >
                  {highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-label text-brand-foreground">
                      Popular
                    </span>
                  )}
                  <CardContent className="space-y-2 pt-8">
                    <div className="font-semibold">{plan.name}</div>
                    <div className="font-display text-3xl">{plan.price}</div>
                    <p className="text-sm text-muted-foreground">{plan.outcome}</p>
                  </CardContent>
                </Card>
              )
            })}
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
          <FaqSection items={HOME_FAQ} title={FAQ_SECTION.title} />
          <div className="mt-6 text-center">
            <Link href="/faq" className="text-sm text-brand link-underline-grow">
              {FAQ_SECTION.viewAll}
            </Link>
          </div>
        </Container>
      </Section>

      {/* Final CTA */}
      <Section spacing="loose" className="border-t border-border/60 bg-muted/20">
        <Container>
          <AuditCtaBlock headline={FINAL_CTA.headline} trustLine={FINAL_CTA.trustLine} />
        </Container>
      </Section>
    </>
  )
}
