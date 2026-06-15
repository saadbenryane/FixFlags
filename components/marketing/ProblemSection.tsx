import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { PROBLEM_SECTION } from '@/lib/marketing/copy'

export function ProblemSection() {
  return (
    <Section spacing="tight" className="bg-muted/25 pt-0">
      <Container className="space-y-10">
        <SectionIntro
          label={PROBLEM_SECTION.label}
          headline={PROBLEM_SECTION.headline}
          subhead={PROBLEM_SECTION.subhead}
        />

        <div className="grid gap-8 md:grid-cols-3">
          {PROBLEM_SECTION.pains.map((pain, i) => (
            <div key={pain.title} className="space-y-3">
              <span className="inline-block w-[5rem] font-mono text-xs tabular-nums text-brand/80">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="space-y-2">
                <h3 className="font-display text-xl tracking-display">{pain.title}</h3>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
                  {pain.body}
                </p>
                <p className="text-xs font-medium text-brand/90">{pain.fixPrompt}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
