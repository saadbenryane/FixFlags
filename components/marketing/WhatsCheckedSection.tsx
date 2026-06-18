import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RUBRICS, WHATS_CHECKED_SECTION } from '@/lib/marketing/copy'

export function WhatsCheckedSection({ id }: { id?: string }) {
  return (
    <Section spacing="marketing" className="scroll-mt-[var(--header-offset)]" id={id}>
      <Container className="space-y-7 sm:space-y-8">
        <LandingSectionHeader
          label={WHATS_CHECKED_SECTION.label}
          headline={WHATS_CHECKED_SECTION.headline}
          align="left"
        />

        <div className="overflow-hidden rounded-card glass-surface shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/20">
                <th
                  className="p-3 pl-5 text-left font-mono text-[10px] uppercase tracking-label text-muted-foreground/80"
                  scope="col"
                >
                  Rubric
                </th>
                <th
                  className="p-3 text-left font-mono text-[10px] uppercase tracking-label text-muted-foreground/80"
                  scope="col"
                >
                  What we check
                </th>
                <th
                  className="p-3 pr-5 text-right font-mono text-[10px] uppercase tracking-label text-muted-foreground/80"
                  scope="col"
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {RUBRICS.map((rubric) => (
                <tr key={rubric.key} className="border-t border-border/20 last:border-b-0">
                  <td className="p-3 pl-5 align-top">
                    <span className="font-display text-base tracking-display">{rubric.name}</span>
                  </td>
                  <td className="p-3 align-top">
                    <p className="max-w-prose text-xs leading-relaxed text-muted-foreground text-pretty">
                      {rubric.whatWeCheck}
                    </p>
                  </td>
                  <td className="p-3 pr-5 align-top text-right">
                    <span className="inline-block rounded-sm bg-muted/40 px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {rubric.statuses}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </Section>
  )
}
