import { FaqSection } from '@/components/marketing/FaqSection'
import { HowItWorksLoopSection } from '@/components/marketing/landing/HowItWorksLoopSection'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHeroSection } from '@/components/marketing/landing/LandingHeroSection'
import { LandingSampleReportSection } from '@/components/marketing/landing/LandingSampleReportSection'
import { LogoCloudSection } from '@/components/marketing/landing/LogoCloudSection'
import { PricingTeaserSection } from '@/components/marketing/landing/PricingTeaserSection'
import { RealImpactSection } from '@/components/marketing/landing/RealImpactSection'
import { TestimonialsSection } from '@/components/marketing/landing/TestimonialsSection'
import { ThreePlacesSection } from '@/components/marketing/landing/ThreePlacesSection'
import { HOME_FAQ } from '@/lib/marketing/copy'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('home', '/')
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const sample = await getLiveSampleAudit()
  const rubrics = sample.audit.rubricRows.map((rubric) => ({
    name: rubric.name,
    score: rubric.score ?? 0,
  }))
  const sampleHref = sample.source === 'static' ? '/samples' : `/report/${sample.audit.id}`

  return (
    <>
      <LandingHeroSection />
      <LogoCloudSection />
      <ThreePlacesSection />
      <HowItWorksLoopSection />
      <RealImpactSection />
      <TestimonialsSection />
      <LandingSampleReportSection
        totalScore={sample.audit.score}
        rubrics={rubrics}
        sampleHref={sampleHref}
        source={sample.source}
      />
      <FaqSection items={HOME_FAQ} title="Questions before you ship" sectionLabel="FAQ" />
      <PricingTeaserSection />
      <LandingFinalCtaSection />
    </>
  )
}
