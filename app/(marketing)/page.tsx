import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHeroSection } from '@/components/marketing/landing/LandingHeroSection'
import { LandingHowItWorksSection } from '@/components/marketing/landing/LandingHowItWorksSection'
import { LandingRubricsSection } from '@/components/marketing/landing/LandingRubricsSection'
import { LandingViewTracker } from '@/components/marketing/landing/LandingViewTracker'
import { SampleReportSection } from '@/components/marketing/landing/SampleReportSection'
import { getCuratedSampleAudit } from '@/lib/marketing/curated-sample'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('home', '/')
export const revalidate = 3600

export default async function HomePage() {
  const sample = await getCuratedSampleAudit()

  return (
    <>
      <LandingViewTracker />
      <LandingHeroSection />
      <SampleReportSection audit={sample.audit} />
      <LandingHowItWorksSection />
      <LandingRubricsSection />
      <LandingFinalCtaSection />
    </>
  )
}
