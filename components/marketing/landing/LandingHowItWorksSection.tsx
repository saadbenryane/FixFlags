import { RefreshCw, ScanSearch, Wrench } from "lucide-react";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LANDING_PAGE } from "@/lib/marketing/copy";
import { cn } from "@/lib/utils";

const STEP_ICONS = [ScanSearch, Wrench, RefreshCw] as const;

export function LandingHowItWorksSection() {
  const copy = LANDING_PAGE.howItWorks;
  const outcomes = [
    copy.demo.evidenceLabel,
    copy.demo.promptStatus,
    copy.demo.recheckLabel,
  ] as const;

  return (
    <Section spacing="marketing" className="overflow-hidden bg-background">
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)] lg:items-start lg:gap-16">
          <RevealOnView className="lg:pt-6">
            <LandingSectionHeader
              align="left"
              label={copy.label}
              headline={copy.headlineDisplay}
              accentPeriod={copy.headlineAccentPeriod}
              subhead={copy.subhead}
              size="lg"
              className="max-w-xl"
            />
          </RevealOnView>

          <RevealOnView className="min-w-0">
            <div className="overflow-hidden rounded-card bg-foreground text-background shadow-[var(--shadow-glass-deep)]">
              <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-5 sm:px-7 sm:pt-6">
                <p className="font-mono text-xs font-semibold uppercase tracking-label text-background/58">
                  {copy.demo.reportTitle}
                </p>
                <p className="text-xs text-background/48">
                  {copy.demo.hostname}
                </p>
              </div>

              <ol className="space-y-3 px-5 pb-6 sm:px-7">
                {copy.steps.map((step, i) => {
                  const Icon = STEP_ICONS[i];
                  return (
                    <li
                      key={step.step}
                      className="group relative grid grid-cols-[3rem_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(9rem,0.62fr)] sm:gap-6 sm:py-6"
                    >
                      <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-background/[0.07] text-brand shadow-[inset_0_0_0_1px_hsl(var(--background)/0.1)]">
                        <Icon
                          className="h-5 w-5"
                          strokeWidth={1.7}
                          aria-hidden
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold uppercase tracking-label text-background/45">
                          Step {step.step}
                        </p>
                        <h3 className="mt-2 font-display text-xl font-semibold leading-heading tracking-heading text-background text-balance sm:text-2xl">
                          {step.title}
                        </h3>
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-background/62 text-pretty sm:text-base">
                          {step.body}
                        </p>
                      </div>

                      <div className="col-start-2 flex items-start gap-2.5 self-center sm:col-start-auto">
                        <span
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            i === copy.steps.length - 1
                              ? "bg-brand shadow-[0_0_0_4px_hsl(var(--brand)/0.13)]"
                              : "bg-background/28",
                          )}
                          aria-hidden
                        />
                        <p className="text-xs leading-relaxed text-background/55 text-pretty">
                          {outcomes[i]}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </RevealOnView>
        </div>
      </Container>
    </Section>
  );
}
