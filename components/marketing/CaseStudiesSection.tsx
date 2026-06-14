import { CASE_STUDIES } from '@/lib/marketing/copy'
import { CaseStudyCard } from '@/components/marketing/CaseStudyCard'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'

export function CaseStudiesSection() {
  return (
    <Section spacing="default">
      <Container className="space-y-12">
        <SectionIntro
          label="Case studies"
          headline="Real fixes, real outcomes"
          subhead="Three pages that improved after a QualityOS audit and a re-check."
        />

        <div className="grid gap-6 md:grid-cols-3">
          {CASE_STUDIES.map((study, i) => (
            <CaseStudyCard key={study.id} study={study} index={i} />
          ))}
        </div>
      </Container>
    </Section>
  )
}
