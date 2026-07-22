import { CheckDimensionsSection } from '@/components/marketing/landing/CheckDimensionsSection'
import { EditorIntegrationsSection } from '@/components/marketing/landing/EditorIntegrationsSection'
import { HowItWorksLoopSection } from '@/components/marketing/landing/HowItWorksLoopSection'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHeroSection } from '@/components/marketing/landing/LandingHeroSection'
import { LandingViewTracker } from '@/components/marketing/landing/LandingViewTracker'
import { SampleReportSection } from '@/components/marketing/landing/SampleReportSection'
import { WhyAiNeedsFixFlagsSection } from '@/components/marketing/landing/WhyAiNeedsFixFlagsSection'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('home', '/')
export const revalidate = 3600

export default async function HomePage() {
  const sample = await getLiveSampleAudit()

  return (
    <>
      <LandingViewTracker />
      <LandingHeroSection />
      <SampleReportSection audit={sample.audit} />
      <HowItWorksLoopSection sampleHref="/samples" />
      <CheckDimensionsSection />
      <WhyAiNeedsFixFlagsSection />
      <EditorIntegrationsSection />
      <LandingFinalCtaSection />
    </>
  )
}
