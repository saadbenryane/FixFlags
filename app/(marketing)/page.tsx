import { CheckDimensionsSection } from '@/components/marketing/landing/CheckDimensionsSection'
import { HowItWorksLoopSection } from '@/components/marketing/landing/HowItWorksLoopSection'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHeroSection } from '@/components/marketing/landing/LandingHeroSection'
import { LandingViewTracker } from '@/components/marketing/landing/LandingViewTracker'
import { ProductProofSection } from '@/components/marketing/landing/ProductProofSection'
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
      <ProductProofSection audit={sample.audit} />
      <CheckDimensionsSection />
      <HowItWorksLoopSection sampleHref="/samples" />
      <LandingFinalCtaSection />
    </>
  )
}
