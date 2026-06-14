import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AuditCtaBlock } from '@/components/marketing/AuditCtaBlock'
import { CaseStudiesSection } from '@/components/marketing/CaseStudiesSection'
import { ComparisonTable } from '@/components/marketing/ComparisonTable'
import { FaqSection } from '@/components/marketing/FaqSection'
import { HeroSection } from '@/components/marketing/HeroSection'
import { HowItWorksSection } from '@/components/marketing/HowItWorksSection'
import { ProblemSection } from '@/components/marketing/ProblemSection'
import { ProofSection } from '@/components/marketing/ProofSection'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { SocialProofSection } from '@/components/marketing/SocialProofSection'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { WhatsCheckedSection } from '@/components/marketing/WhatsCheckedSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import {
  DIFFERENTIATION,
  MCP_SECTION,
  PRICING_TEASER,
  FINAL_CTA,
  HOME_FAQ,
  FAQ_SECTION,
} from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { cn } from '@/lib/utils'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'

export const metadata = buildPageMetadata('home', '/')
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const sample = await getLiveSampleAudit()
  return (
    <>
      <HeroSection sample={sample} />

      <ProofSection sample={sample} />

      <SocialProofSection />

      <ProblemSection />

      <HowItWorksSection />

      <CaseStudiesSection />

      <WhatsCheckedSection />

      <Section spacing="default" className="bg-muted/35">
        <Container className="space-y-10">
          <SectionIntro
            headline={DIFFERENTIATION.headline}
            subhead={DIFFERENTIATION.subhead}
          />
          <p className="text-center text-sm text-muted-foreground">
            Compare with{' '}
            <a
              href="https://developer.chrome.com/docs/lighthouse"
              className="text-brand underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Lighthouse
            </a>
            .
          </p>
          <ComparisonTable rows={DIFFERENTIATION.rows} />
        </Container>
      </Section>

      <Section spacing="default">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:gap-14">
            <div className="space-y-6">
              <SectionIntro
                align="left"
                headline={MCP_SECTION.headline}
                subhead={MCP_SECTION.body}
              />
              <Button variant="outline" asChild>
                <Link href="/docs/mcp">
                  {MCP_SECTION.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <TerminalBlock label="Agent workflow">{MCP_SECTION.workflow}</TerminalBlock>
          </div>
        </Container>
      </Section>

      <Section spacing="default" className="bg-muted/35">
        <Container className="space-y-10">
          <SectionIntro headline={PRICING_TEASER.headline} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PRICING_TEASER.plans.map((plan) => {
              const highlighted = plan.name === 'Pro'
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
                    <div className="font-display text-3xl tabular-nums">{plan.price}</div>
                    <p className="text-sm text-muted-foreground text-pretty">{plan.outcome}</p>
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
