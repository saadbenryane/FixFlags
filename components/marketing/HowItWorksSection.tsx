import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Heading } from '@/components/ui/typography'
import { HOW_IT_WORKS_SECTION } from '@/lib/marketing/copy'

export function HowItWorksSection() {
  return (
    <Section spacing="default">
      <Container className="space-y-12">
        <SectionIntro
          label={HOW_IT_WORKS_SECTION.label}
          headline={HOW_IT_WORKS_SECTION.headline}
          subhead={HOW_IT_WORKS_SECTION.subhead}
        />

        <ol className="divide-y divide-border/20">
          {HOW_IT_WORKS_SECTION.steps.map((step, index) => (
            <li
              key={step.step}
              className="grid gap-4 py-7 first:pt-0 last:pb-0 md:grid-cols-[5rem_minmax(0,0.35fr)_minmax(0,0.65fr)] md:items-baseline md:gap-8"
            >
              <span className="font-mono text-xs tabular-nums text-brand/80">
                {String(index + 1).padStart(2, '0')}
              </span>
              <Heading as="h3" className="text-xl">
                {step.title}
              </Heading>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
