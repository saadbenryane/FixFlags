import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PricingViewTracker } from '@/components/pricing/PricingViewTracker'
import { PricingComparisonTable } from '@/components/pricing/PricingComparisonTable'
import { FaqSection } from '@/components/marketing/FaqSection'
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PRICING, PRICING_FAQ } from '@/lib/marketing/copy/plans'
import s from './PricingPage.module.css'

export function PricingPage() {
  return <Section spacing="overview" className={s.page}>
    <PricingViewTracker />
    <Container variant="marketing" className={s.container}>
      <MarketingPageHeader eyebrow={PRICING.label} title={<>{PRICING.headlineLead}{' '}<span className={s.betaHeadline}>{PRICING.headlineAccent}</span></>} description={PRICING.subhead}>
        <Button asChild variant="brand" size="lg"><Link href={PRICING.signupHref}>{PRICING.signupCta}<ArrowRight aria-hidden size={16} /></Link></Button>
        <p className={s.signupNote}>{PRICING.signupNote}</p>
      </MarketingPageHeader>
      <div className={s.sections}>
        <section aria-labelledby="pricing-comparison-heading" className={s.comparison} id="compare-plans">
          <h2 className="sr-only" id="pricing-comparison-heading">{PRICING.compareTitle}</h2>
          <PricingComparisonTable />
          <div className={s.links}><Link href="/docs/site-care">{PRICING.coverageLink}<ArrowRight aria-hidden size={16} /></Link><Link href="/docs/integrations">{PRICING.connectionsLink}<ArrowRight aria-hidden size={16} /></Link></div>
        </section>
        <div className={s.faq}><FaqSection items={PRICING_FAQ} title={PRICING.faqTitle} sectionLabel={null} /></div>
      </div>
    </Container>
  </Section>
}
