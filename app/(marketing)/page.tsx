import { CheckDimensionsSection } from '@/components/marketing/landing/CheckDimensionsSection'
import { EditorIntegrationsSection } from '@/components/marketing/landing/EditorIntegrationsSection'
import { HowItWorksLoopSection } from '@/components/marketing/landing/HowItWorksLoopSection'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHeroSection } from '@/components/marketing/landing/LandingHeroSection'
import { LandingViewTracker } from '@/components/marketing/landing/LandingViewTracker'
import { SampleReportSection } from '@/components/marketing/landing/SampleReportSection'
import { WhyBuildersChooseSection } from '@/components/marketing/landing/WhyBuildersChooseSection'
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
      <HowItWorksLoopSection sampleHref="/samples" />
      <CheckDimensionsSection />
      <WhyBuildersChooseSection />
      <EditorIntegrationsSection />
      <LandingFinalCtaSection />
    </>
  )
}
