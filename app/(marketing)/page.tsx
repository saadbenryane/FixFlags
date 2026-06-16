import { HowItWorksLoopSection } from '@/components/marketing/landing/HowItWorksLoopSection'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHeroSection } from '@/components/marketing/landing/LandingHeroSection'
import { LandingSampleReportSection } from '@/components/marketing/landing/LandingSampleReportSection'
import { LogoCloudSection } from '@/components/marketing/landing/LogoCloudSection'
import { RealImpactSection } from '@/components/marketing/landing/RealImpactSection'
import { TestimonialsSection } from '@/components/marketing/landing/TestimonialsSection'
import { ThreePlacesSection } from '@/components/marketing/landing/ThreePlacesSection'
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
      <LandingFinalCtaSection />
    </>
  )
}
