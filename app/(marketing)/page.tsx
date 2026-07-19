import { CheckDimensionsSection } from '@/components/marketing/landing/CheckDimensionsSection'
import { HowItWorksLoopSection } from '@/components/marketing/landing/HowItWorksLoopSection'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHeroSection } from '@/components/marketing/landing/LandingHeroSection'
import { SampleReportSection } from '@/components/marketing/landing/SampleReportSection'
import { TestimonialsSection } from '@/components/marketing/landing/TestimonialsSection'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('home', '/')
export const revalidate = 3600

export default async function HomePage() {
  const sample = await getLiveSampleAudit()

  return (
    <>
      <LandingHeroSection />
      <SampleReportSection
        audit={sample.audit}
      />
      <CheckDimensionsSection />
      <HowItWorksLoopSection sampleHref="/samples" />
      <TestimonialsSection />
      <LandingFinalCtaSection />
    </>
  )
}
