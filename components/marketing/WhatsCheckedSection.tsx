import { Container } from '@/components/ui/container'
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { RUBRICS, WHATS_CHECKED_SECTION } from '@/lib/marketing/copy'

export function WhatsCheckedSection({ id }: { id?: string }) {
  return (
    <Section spacing="default" className="scroll-mt-[var(--header-offset)] bg-muted/35" id={id}>
      <Container>
        <PageGrid align="start">
          <PageGridCol span="intro">
            <SectionIntro
              align="left"
              label={WHATS_CHECKED_SECTION.label}
              headline={WHATS_CHECKED_SECTION.headline}
              subhead={WHATS_CHECKED_SECTION.subhead}
            />
          </PageGridCol>

          <PageGridCol span="content">
            <div className="overflow-hidden rounded-card border-0 bg-card shadow-card">
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
          </PageGridCol>
        </PageGrid>
      </Container>
    </Section>
  )
}
