import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
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
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import {
  DIFFERENTIATION,
  MCP_SECTION,
  PRICING_TEASER,
  BRAND,
  FAQ_SECTION,
  HOME_FAQ,
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

      <CaseStudiesSection />

      <ProblemSection />

      <SocialProofSection />

      <HowItWorksSection />

      <Section spacing="default" id="agent-workflow">
        <Container>
          <PageGrid align="start">
            <PageGridCol span="intro" className="space-y-6">
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
            </PageGridCol>
            <PageGridCol span="content">
              <TerminalBlock label="Agent workflow">{MCP_SECTION.workflow}</TerminalBlock>
            </PageGridCol>
          </PageGrid>
        </Container>
      </Section>

      <WhatsCheckedSection />

      <Section spacing="default" className="bg-muted/35" id="lighthouse-comparison">
        <Container className="space-y-10">
          <SectionIntro headline={DIFFERENTIATION.headline} subhead={DIFFERENTIATION.subhead} />
          <p className="mx-auto max-w-prose text-center text-sm text-muted-foreground">
            Compare with{' '}
            <a
              href="https://developer.chrome.com/docs/lighthouse"
              className="text-link underline underline-offset-2 transition-colors duration-200 hover:text-link-hover"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Lighthouse
            </a>
            .
          </p>
          <ComparisonTable rows={DIFFERENTIATION.rows} />
          <p className="mx-auto max-w-prose text-center text-xs text-muted-foreground">
            Lighthouse SEO checks meta tags including og:image; {BRAND.name} adds screenshot-based
            UX context and agent-ready fix prompts.
          </p>
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
                    'relative flex h-full flex-col border-0 text-center shadow-card',
                    highlighted && 'bg-brand/[0.03] shadow-card-hover'
                  )}
                >
                  {highlighted ? (
                    <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-label text-brand-foreground">
                      Popular
                    </span>
                  ) : null}
                  <CardContent className="flex flex-1 flex-col space-y-4 pt-8">
                    <div className="font-semibold">{plan.name}</div>
                    <div className="font-display text-3xl tabular-nums">{plan.price}</div>
                    <p className="flex-1 text-sm text-muted-foreground text-pretty">{plan.outcome}</p>
                    <Button
                      variant={highlighted ? 'default' : 'outline'}
                      size="default"
                      asChild
                      className="mt-auto w-full"
                    >
                      <Link href={plan.href}>{plan.cta}</Link>
                    </Button>
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
        <Container>
          <div className="mx-auto max-w-prose">
            <FaqSection items={HOME_FAQ} title={FAQ_SECTION.title} />
            <div className="mt-6 text-center">
              <TextLink href="/faq" className="text-sm">
                {FAQ_SECTION.viewAll}
              </TextLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
