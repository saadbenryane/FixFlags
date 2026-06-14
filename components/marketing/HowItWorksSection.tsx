import { Container } from '@/components/ui/container'
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Heading } from '@/components/ui/typography'
import { HOW_IT_WORKS_SECTION } from '@/lib/marketing/copy'

const STEP_NUMBER_COL = 'col-span-12 sm:col-span-1 sm:max-w-[5rem]'

export function HowItWorksSection() {
  return (
    <Section spacing="default">
      <Container className="space-y-10">
        <SectionIntro
          label={HOW_IT_WORKS_SECTION.label}
          headline={HOW_IT_WORKS_SECTION.headline}
          subhead={HOW_IT_WORKS_SECTION.subhead}
        />

        <ol className="space-y-6">
          {HOW_IT_WORKS_SECTION.steps.map((step, index) => (
            <li key={step.step}>
              <PageGrid align="baseline" className="gap-y-3">
                <PageGridCol className={STEP_NUMBER_COL}>
                  <span className="font-mono text-xs tabular-nums text-brand/80">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </PageGridCol>
                <PageGridCol className="col-span-12 sm:col-span-4">
                  <Heading as="h3" className="text-xl">
                    {step.title}
                  </Heading>
                </PageGridCol>
                <PageGridCol className="col-span-12 sm:col-span-7">
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
                    {step.body}
                  </p>
                </PageGridCol>
              </PageGrid>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
