import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
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

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {HOW_IT_WORKS_SECTION.steps.map((step) => (
            <div key={step.step} className="space-y-2">
              <span className="font-mono text-sm tabular-nums text-muted-foreground/70">{step.step}</span>
              <div className="font-semibold">{step.title}</div>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
