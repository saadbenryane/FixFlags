import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body } from '@/components/ui/typography'
import { AI_REVIEW_SECTION } from '@/lib/marketing/copy'

export function AiReviewSection() {
  return (
    <Section spacing="default" className="bg-muted/35">
      <Container className="space-y-12">
        <div className="mx-auto max-w-xl space-y-3 text-center">
          <h2 className="font-display text-[1.75rem] leading-display tracking-display text-balance sm:text-[2.125rem]">
            {AI_REVIEW_SECTION.headline}
          </h2>
          <Body className="text-muted-foreground">{AI_REVIEW_SECTION.subhead}</Body>
        </div>

        <div className="grid gap-8 md:grid-cols-3 md:gap-6">
          {AI_REVIEW_SECTION.steps.map((step, i) => (
            <div key={step.title} className="space-y-2 text-center md:text-left">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-display text-xl tracking-display">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
