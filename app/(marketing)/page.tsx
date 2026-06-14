import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AuditCtaBlock } from '@/components/marketing/AuditCtaBlock'
import { ComparisonTable } from '@/components/marketing/ComparisonTable'
import { FaqSection } from '@/components/marketing/FaqSection'
import { HeroSection } from '@/components/marketing/HeroSection'
import { HowItWorksSection } from '@/components/marketing/HowItWorksSection'
import { ProofSection } from '@/components/marketing/ProofSection'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { WhatsCheckedSection } from '@/components/marketing/WhatsCheckedSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import {
  PROBLEM_SECTION,
  DIFFERENTIATION,
  MCP_SECTION,
  PRICING_TEASER,
  FINAL_CTA,
  HOME_FAQ,
  FAQ_SECTION,
} from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { cn } from '@/lib/utils'

export const metadata = buildPageMetadata('home', '/')

export default function HomePage() {
  return (
    <>
      {/* 1. Hero — promise, CTA, live proof card */}
      <HeroSection />

      {/* 2. What's checked — address "what does it audit?" early */}
      <WhatsCheckedSection />

      {/* 3. How it works — single merged flow (no duplicate mechanism section) */}
      <HowItWorksSection />

      {/* 4. Problem — empathy, why scores aren't enough */}
      <Section spacing="default" className="bg-muted/35">
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

      {/* 5. Proof — sample report, scores, demo path */}
      <ProofSection />

      {/* 6. Differentiation — vs Lighthouse / manual QA */}
      <Section spacing="default">
        <Container className="space-y-10">
          <SectionIntro headline={DIFFERENTIATION.headline} />
          <ComparisonTable rows={DIFFERENTIATION.rows} />
        </Container>
      </Section>

      {/* 7. MCP — power-user path (secondary, compact) */}
      <Section spacing="default" className="bg-muted/35">
        <Container className="max-w-3xl space-y-8">
          <SectionIntro headline={MCP_SECTION.headline} subhead={MCP_SECTION.body} />
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

      {/* 8. Pricing teaser */}
      <Section spacing="default">
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
                    'relative border-0 text-center shadow-card',
                    highlighted && 'shadow-card-hover bg-brand/[0.03]'
                  )}
                >
                  {highlighted ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-label text-brand-foreground">
                      Popular
                    </span>
                  ) : null}
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

      {/* 9. FAQ — objections */}
      <Section spacing="default" className="bg-muted/35">
        <Container className="max-w-2xl">
          <FaqSection items={HOME_FAQ} title={FAQ_SECTION.title} />
          <div className="mt-6 text-center">
            <Link href="/faq" className="text-sm text-brand link-underline-grow">
              {FAQ_SECTION.viewAll}
            </Link>
          </div>
        </Container>
      </Section>

      {/* 10. Final CTA */}
      <Section spacing="loose">
        <Container>
          <AuditCtaBlock headline={FINAL_CTA.headline} trustLine={FINAL_CTA.trustLine} />
        </Container>
      </Section>
    </>
  )
}
