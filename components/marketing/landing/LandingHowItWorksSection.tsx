import { RefreshCw, ScanSearch, Wrench } from "lucide-react";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LANDING_PAGE } from "@/lib/marketing/copy";

const STEP_ICONS = [ScanSearch, Wrench, RefreshCw] as const;

export function LandingHowItWorksSection() {
  const copy = LANDING_PAGE.howItWorks;

  return (
    <Section spacing="marketing" className="overflow-hidden bg-background">
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <LandingSectionHeader
            align="left"
            label={copy.label}
            headline={copy.headlineDisplay}
            accentPeriod={copy.headlineAccentPeriod}
            subhead={copy.subhead}
            size="lg"
            className="max-w-2xl"
          />
        </RevealOnView>

        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8 lg:mt-16 lg:gap-12">
          {copy.steps.map((step, index) => {
            const Icon = STEP_ICONS[index];
            return (
              <li key={step.step} className="min-w-0">
                <RevealOnView>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-muted/55 text-brand shadow-[var(--shadow-glass-subtle)]">
                      <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
                    </span>
                    <span className="font-mono text-xs font-semibold uppercase tracking-label text-muted-foreground">
                      Step {step.step}
                    </span>
                  </div>
                  <h3 className="mt-5 max-w-[15ch] font-display text-2xl font-semibold leading-heading tracking-heading text-foreground text-balance">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
                    {step.body}
                  </p>
                </RevealOnView>
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
