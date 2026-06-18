import { HowItWorksLoopSection } from '@/components/marketing/landing/HowItWorksLoopSection'
import { CheckDimensionsSection } from '@/components/marketing/landing/CheckDimensionsSection'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHeroSection } from '@/components/marketing/landing/LandingHeroSection'
import { LandingSampleReportSection } from '@/components/marketing/landing/LandingSampleReportSection'
import { LogoCloudSection } from '@/components/marketing/landing/LogoCloudSection'
import { RealImpactSection } from '@/components/marketing/landing/RealImpactSection'
import { TestimonialsSection } from '@/components/marketing/landing/TestimonialsSection'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
export const metadata = buildPageMetadata('home', '/')
export const revalidate = 3600

export default async function HomePage() {
  let sample = null
  try {
    sample = await getLiveSampleAudit()
  } catch {
    sample = {
      audit: getStaticSampleAudit(),
      source: 'static' as const,
      pipelineVersion: PIPELINE_VERSION,
      completedAt: new Date(),
    }
  }

  const sampleHref = sample.source === 'static' ? '/samples' : `/report/${sample.audit.id}`

  return (
    <>
      <LandingHeroSection />
      <LogoCloudSection />
      <CheckDimensionsSection />
      <HowItWorksLoopSection />
      <RealImpactSection />
      <TestimonialsSection />
      <LandingSampleReportSection
        audit={sample.audit}
        sampleHref={sampleHref}
        source={sample.source}
      />
      <LandingFinalCtaSection />
    </>
  )
}
