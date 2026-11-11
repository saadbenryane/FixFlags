import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PricingViewTracker } from '@/components/pricing/PricingViewTracker'
import { PricingComparisonTable } from '@/components/pricing/PricingComparisonTable'
import { PricingImpact, PricingStory, PricingToolComparison } from '@/components/pricing/PricingSections'
import { FaqSection } from '@/components/marketing/FaqSection'
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader'
import { MarketingSectionHeader } from '@/components/marketing/MarketingSectionHeader'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PRICING } from '@/lib/marketing/copy/plans'
import { PRICING_PAGE_FAQ } from '@/lib/marketing/copy/pricing-page'
import s from './PricingPage.module.css'

export function PricingPage() {
  return <Section spacing="overview" className={s.page}>
    <PricingViewTracker />
    <Container variant="marketing" className={s.container}>
      <MarketingPageHeader eyebrow={PRICING.label} lines={[PRICING.headlineLead, PRICING.headlineAccent]} description={PRICING.subhead}>
        <Button asChild variant="brand" size="lg"><Link prefetch={false} href={PRICING.signupHref}>{PRICING.signupCta}<ArrowRight aria-hidden size={16} /></Link></Button>
        <p className={s.signupNote}>{PRICING.signupNote}</p>
      </MarketingPageHeader>
      <div className={s.sections}>
        <section aria-labelledby="pricing-plans-heading" className={s.plans} id="plans">
          <h2 className="sr-only" id="pricing-plans-heading">{PRICING.plansTitle}</h2>
          <PricingComparisonTable />
        </section>
        <PricingStory />
        <PricingToolComparison />
        <PricingImpact />
        <section className={s.faq} aria-labelledby="pricing-faq-title"><MarketingSectionHeader id="pricing-faq-title" lines={PRICING.faqLines} align="center" /><FaqSection items={PRICING_PAGE_FAQ} title="" sectionLabel={null} /></section>
      </div>
    </Container>
  </Section>
}
