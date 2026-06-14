import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { QUALITY_AREAS, WHATS_CHECKED_SECTION } from '@/lib/marketing/copy'

export function WhatsCheckedSection() {
  return (
    <Section spacing="default" className="bg-muted/35">
      <Container className="space-y-12">
        <SectionIntro
          label={WHATS_CHECKED_SECTION.label}
          headline={WHATS_CHECKED_SECTION.headline}
          subhead={WHATS_CHECKED_SECTION.subhead}
        />

        <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-10">
          {QUALITY_AREAS.map((area, i) => (
            <div key={area.name} className="space-y-1.5">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-display text-lg tracking-display">{area.name}</h3>
              </div>
              <p className="pl-7 text-sm leading-relaxed text-muted-foreground text-pretty">{area.impact}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
