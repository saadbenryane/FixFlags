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

        <ol className="grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS_SECTION.steps.map((step) => (
            <li
              key={step.step}
              className="rounded-card bg-card p-6 shadow-card transition-shadow duration-200 hover:shadow-card-hover"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
                  Step {step.step}
                </span>
                <span className="font-display text-2xl tabular-nums leading-none text-muted-foreground/20">
                  {String(step.step).padStart(2, '0')}
                </span>
              </div>
              <div className="space-y-2">
                <p className="font-semibold leading-snug">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
