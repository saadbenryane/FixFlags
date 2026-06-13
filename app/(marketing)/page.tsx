import { FaqSection } from '@/components/marketing/FaqSection'
import { HeroSection } from '@/components/marketing/HeroSection'
import { AiReviewSection } from '@/components/marketing/AiReviewSection'
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
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata = buildPageMetadata('home', '/')

export default function HomePage() {
  return (
    <>
      <HeroSection />

      <AiReviewSection />

      <Section spacing="default">
        <Container className="space-y-12">
          <SectionIntro headline={PROBLEM_SECTION.headline} />
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {PROBLEM_SECTION.pains.map((pain) => (
              <div key={pain.title} className="space-y-2">
                <h3 className="font-display text-lg tracking-display">{pain.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{pain.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section spacing="default" className="bg-muted/35">
        <Container className="space-y-12">
          <SectionIntro headline={WORKFLOW_SECTION.headline} />
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.step} className="space-y-2">
                <span className="font-mono text-sm tabular-nums text-muted-foreground/70">{step.step}</span>
                <div className="font-semibold">{step.title}</div>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section spacing="default">
        <Container className="space-y-10">
          <SectionIntro headline={DIFFERENTIATION.headline} />
          <ComparisonTable rows={DIFFERENTIATION.rows} />
        </Container>
      </Section>

      <Section spacing="default" className="bg-muted/35">
        <Container className="space-y-8">
          <SectionIntro headline={SOCIAL_PROOF.headline} />
          <div className="mx-auto max-w-lg">
            <Card interactive className="overflow-hidden shadow-card">
              <CardContent className="space-y-4 p-0">
                <div className="flex items-center justify-between bg-muted/30 px-6 py-4">
                  <span className="font-semibold">{SOCIAL_PROOF.sample.name}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-bold tabular-nums text-brand">
                      {SOCIAL_PROOF.sample.score}
                    </span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </div>
                <p className="px-6 pb-6 text-sm leading-relaxed text-muted-foreground text-pretty">
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

      <Section spacing="default">
        <Container>
          <AuditCtaBlock headline={MID_CTA.headline} trustLine={MID_CTA.trustLine} />
        </Container>
      </Section>

      <Section spacing="default" className="bg-muted/35">
        <Container className="space-y-10">
          <SectionIntro headline={QUALITY_AREAS_SECTION.headline} />
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
            {QUALITY_AREAS.map((area) => (
              <div key={area.name}>
                <p className="font-semibold">{area.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{area.impact}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section spacing="default">
        <Container className="max-w-3xl space-y-8">
          <div className="space-y-3 text-center">
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

      <Section spacing="default" className="bg-muted/35">
        <Container className="space-y-10">
          <SectionIntro headline={PRICING_TEASER.headline} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PRICING_TEASER.plans.map((plan) => {
              const highlighted = plan.name === 'Builder'
              return (
                <Card
                  key={plan.name}
                  interactive
                  className={cn(
                    'relative text-center',
                    highlighted && 'shadow-card-hover bg-brand/[0.03]'
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

      <Section spacing="loose" className="bg-muted/35">
        <Container>
          <AuditCtaBlock headline={FINAL_CTA.headline} trustLine={FINAL_CTA.trustLine} />
        </Container>
      </Section>
    </>
  )
}
