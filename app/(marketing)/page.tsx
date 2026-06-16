import {
  FourPlacesSection,
} from '@/components/marketing/landing/FourPlacesSection'
import { HowItWorksLoopSection } from '@/components/marketing/landing/HowItWorksLoopSection'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHeroSection } from '@/components/marketing/landing/LandingHeroSection'
import { LandingSampleReportSection } from '@/components/marketing/landing/LandingSampleReportSection'
import { LogoCloudSection } from '@/components/marketing/landing/LogoCloudSection'
import { RealImpactSection } from '@/components/marketing/landing/RealImpactSection'
import { TestimonialsSection } from '@/components/marketing/landing/TestimonialsSection'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('home', '/')
export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <>
      <LandingHeroSection />
      <LogoCloudSection />
      <FourPlacesSection />
      <HowItWorksLoopSection />
      <RealImpactSection />
      <TestimonialsSection />
      <LandingSampleReportSection />
      <LandingFinalCtaSection />
    </>
  )
}
