import { CASE_STUDIES } from '@/lib/marketing/copy'
import { CaseStudyCard } from '@/components/marketing/CaseStudyCard'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'

export function CaseStudiesSection() {
  return (
    <Section spacing="default">
      <Container className="space-y-10">
        <SectionIntro
          label="Case studies"
          headline="Illustrative fixes, representative outcomes"
          subhead="Three example pages that improved after applying audit findings and re-checking."
        />

        <div className="grid gap-6 md:grid-cols-3">
          {CASE_STUDIES.map((study, i) => (
            <CaseStudyCard key={study.id} study={study} index={i} />
          ))}
        </div>

        <ThirdPartyAuditDisclaimer variant="compact" className="max-w-prose" />
      </Container>
    </Section>
  )
}
