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

          <div className="overflow-hidden rounded-card border-0 bg-card shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="p-3 pl-5 text-left font-mono text-[10px] uppercase tracking-label text-muted-foreground/80" scope="col">Area</th>
                  <th className="p-3 text-left font-mono text-[10px] uppercase tracking-label text-muted-foreground/80" scope="col">What we check</th>
                  <th className="p-3 pr-5 text-right font-mono text-[10px] uppercase tracking-label text-muted-foreground/80" scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {QUALITY_AREAS.map((area) => (
                  <tr key={area.name} className="border-t border-border/20 last:border-b-0">
                    <td className="p-3 pl-5 align-top">
                      <span className="font-display text-base tracking-display">{area.name}</span>
                    </td>
                    <td className="p-3 align-top">
                      <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{area.whatWeCheck}</p>
                    </td>
                    <td className="p-3 pr-5 align-top text-right">
                      <span className="inline-block rounded-sm bg-muted/40 px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {area.scoreFormat}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </Section>
  )
}
