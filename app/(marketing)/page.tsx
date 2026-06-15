import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CaseStudiesSection } from '@/components/marketing/CaseStudiesSection'
import { DifferentiationSection } from '@/components/marketing/DifferentiationSection'
import { FaqSection } from '@/components/marketing/FaqSection'
import { HeroSection } from '@/components/marketing/HeroSection'
import { HowItWorksSection } from '@/components/marketing/HowItWorksSection'
import { ProofSection } from '@/components/marketing/ProofSection'
import { SegmentProofSection } from '@/components/marketing/SegmentProofSection'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import {
  MCP_SECTION,
  PRICING_TEASER,
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

      <SegmentProofSection />

      <HowItWorksSection />

      <DifferentiationSection />

      <CaseStudiesSection />

      <Section spacing="default" className="bg-muted/35" id="agent-workflow">
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

      <Section spacing="default">
        <Container className="space-y-10">
          <SectionIntro headline={PRICING_TEASER.headline} subhead={PRICING_TEASER.subhead} />
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

      <Section spacing="default" className="bg-muted/35">
        <Container>
          <div className="mx-auto max-w-prose">
            <FaqSection items={HOME_FAQ} title={FAQ_SECTION.title} />
            <div className="mt-6 space-y-3 text-center">
              <TextLink href="/faq#rubric" className="text-sm">
                See scoring rubric
              </TextLink>
              <div>
                <TextLink href="/faq" className="text-sm">
                  {FAQ_SECTION.viewAll}
                </TextLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
