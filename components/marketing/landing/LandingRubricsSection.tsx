import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LANDING_PAGE } from "@/lib/marketing/copy";
import { rubricIcon } from "@/lib/rubric-icons";

export function LandingRubricsSection() {
  const copy = LANDING_PAGE.checkDimensions;

  return (
    <Section spacing="marketing" tint="subtle" className="overflow-hidden">
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <LandingSectionHeader
            align="left"
            label={copy.label}
            headline={copy.headlineDisplay}
            accentPeriod={copy.headlineAccentPeriod}
            subhead={copy.subhead}
            size="lg"
            className="max-w-3xl"
          />
        </RevealOnView>

        <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8 lg:mt-16 lg:gap-12">
          {copy.cards.map((rubric) => {
            const Icon = rubricIcon(rubric.icon);
            return (
              <RevealOnView key={rubric.id} className="min-w-0">
                <article className="flex h-full flex-col">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-background text-brand shadow-[var(--shadow-glass-subtle)]">
                      <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
                    </span>
                    <span className="font-mono text-xs font-semibold uppercase tracking-label text-brand">
                      {rubric.title}
                    </span>
                  </div>
                <h3 className="mt-4 max-w-[14ch] font-display text-2xl font-semibold leading-heading tracking-heading text-foreground text-balance">
                  {rubric.question}
                </h3>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
                  {rubric.panelBody}
                </p>

                <div className="mt-7 rounded-[var(--radius-inner)] bg-background/80 p-5 shadow-[var(--shadow-glass-subtle)]">
                  <p className="font-mono text-2xs font-semibold uppercase tracking-label text-[hsl(var(--brand-strong))] dark:text-brand">
                    {copy.exampleFindingLabel}
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-snug text-foreground text-pretty">
                    {rubric.proofExample.finding}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground text-pretty">
                    {rubric.proofExample.evidence}
                  </p>
                </div>
                </article>
              </RevealOnView>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
