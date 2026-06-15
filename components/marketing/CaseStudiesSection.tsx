import { CASE_STUDIES, CASE_STUDIES_SECTION } from '@/lib/marketing/copy'
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
          label={CASE_STUDIES_SECTION.label}
          headline={CASE_STUDIES_SECTION.headline}
          subhead={CASE_STUDIES_SECTION.subhead}
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
