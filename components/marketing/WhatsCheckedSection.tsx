import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { QUALITY_AREAS, WHATS_CHECKED_SECTION } from '@/lib/marketing/copy'

export function WhatsCheckedSection() {
  return (
    <Section spacing="default" className="bg-muted/35">
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)] lg:gap-16">
          <SectionIntro
            align="left"
            label={WHATS_CHECKED_SECTION.label}
            headline={WHATS_CHECKED_SECTION.headline}
            subhead={WHATS_CHECKED_SECTION.subhead}
          />

          <ul className="divide-y divide-border/15 rounded-card border-0 bg-card shadow-card">
            {QUALITY_AREAS.map((area) => (
              <li
                key={area.name}
                className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <span className="shrink-0 font-display text-base tracking-display">{area.name}</span>
                <span className="text-sm leading-relaxed text-muted-foreground text-pretty sm:text-right">
                  {area.impact}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  )
}
