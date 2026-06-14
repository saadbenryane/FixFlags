import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { PROBLEM_SECTION } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function ProblemSection() {
  return (
    <Section spacing="default" className="bg-muted/35">
      <Container className="space-y-12">
        <SectionIntro headline={PROBLEM_SECTION.headline} />

        <div className="grid gap-8 md:grid-cols-3">
          {PROBLEM_SECTION.pains.map((pain, i) => (
            <div
              key={pain.title}
              className={cn('space-y-3', i > 0 && 'md:border-l md:border-border/20 md:pl-8')}
            >
              <span className="font-mono text-xs tabular-nums text-brand/80">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="space-y-2">
                <h3 className="font-display text-xl tracking-display">{pain.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{pain.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
