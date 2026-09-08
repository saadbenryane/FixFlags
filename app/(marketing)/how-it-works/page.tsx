import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHowItWorksSection } from '@/components/marketing/landing/LandingHowItWorksSection'
import { LandingLayersSection } from '@/components/marketing/landing/LandingLayersSection'
import { LandingProofSection } from '@/components/marketing/landing/LandingProofSection'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { AuditInput } from '@/components/audit/AuditInput'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { HOW_IT_WORKS_PAGE } from '@/lib/marketing/copy'

export const metadata = buildPageMetadata('howItWorks', '/how-it-works')

export default function HowItWorksPage() {
  const { hero } = HOW_IT_WORKS_PAGE

  return (
    <>
      <MarketingPageViewTracker page="/how-it-works" />
      <Section spacing="hero" className="!pb-10 !pt-10">
        <Container variant="marketing" className="max-w-3xl px-4 sm:px-6">
          <p className="text-sm font-medium text-brand">{hero.eyebrow}</p>
          <Heading as="h1" className="mt-3 font-display text-4xl font-bold tracking-display sm:text-5xl">
            {hero.headline.replace(/\.$/, '')}
            {hero.headlineAccentPeriod ? <span className="text-brand">.</span> : null}
          </Heading>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {hero.subhead}
          </p>
          <div className="mt-8 max-w-2xl">
            <AuditInput variant="landing" idSuffix="-how-it-works" />
          </div>
        </Container>
      </Section>
      <LandingProofSection />
      <LandingHowItWorksSection />
      <LandingLayersSection />
      <Section spacing="compact" className="bg-muted/15">
        <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
          <div className="grid gap-5 rounded-card bg-background p-6 shadow-card md:grid-cols-[1fr_auto] md:items-center sm:p-8">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-label text-brand">Shopify connection</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">Add commerce context when your Site needs it.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Shopify adds product structure and independent purchase-path verification to the same FixFlags Site.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/install">Connect Shopify</Link>
            </Button>
          </div>
        </Container>
      </Section>
      <LandingFinalCtaSection />
    </>
  )
}
import Link from 'next/link'
