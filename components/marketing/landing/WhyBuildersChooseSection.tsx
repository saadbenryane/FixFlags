import {
  Code2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LANDING_PAGE } from "@/lib/marketing/copy";
import { cn } from "@/lib/utils";

const FEATURE_ICONS = {
  sparkles: Sparkles,
  code: Code2,
  trend: TrendingUp,
  shield: ShieldCheck,
  refresh: RefreshCw,
} as const;

export function WhyBuildersChooseSection() {
  const copy = LANDING_PAGE.whyBuildersChoose;
  const [headlineLead, headlineTail = ""] = copy.headlineDisplay.split(". ");

  return (
    <Section
      spacing="compact"
      id="why-fixflags"
      className="scroll-mt-[var(--header-offset)] pb-3 pt-8 sm:pb-6 sm:pt-7 lg:pb-6 lg:pt-5"
    >
      <Container
        variant="marketing"
        className="space-y-9 px-4 sm:px-6 lg:space-y-8 lg:px-12"
      >
        <RevealOnView>
          <div className="mx-auto max-w-[58rem] space-y-3 text-center">
            <p className="inline-flex items-center justify-center gap-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand sm:text-xs">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                aria-hidden
              />
              {copy.label}
            </p>
            <h2 className="font-display text-[2rem] font-bold leading-[1.04] tracking-display text-foreground sm:text-[2.375rem] lg:text-[2.5rem]">
              <span className="block">{headlineLead}.</span>
              <span className="block">
                {headlineTail}
                {copy.headlineAccentPeriod ? (
                  <span className="text-brand" aria-hidden>
                    .
                  </span>
                ) : null}
              </span>
            </h2>
            <p className="mx-auto max-w-[41rem] text-[0.875rem] leading-[1.55] text-muted-foreground sm:text-[0.9375rem]">
              {copy.subhead}
            </p>
          </div>
        </RevealOnView>

        <RevealOnView>
          <ul className="mx-auto grid max-w-[78rem] grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-5 lg:gap-0">
            {copy.features.map((feature, index) => {
              const Icon = FEATURE_ICONS[feature.icon];
              return (
                <li
                  key={feature.id}
                  className={cn(
                    "relative px-4 text-center",
                    index > 0 &&
                      "lg:before:absolute lg:before:-left-px lg:before:top-6 lg:before:h-24 lg:before:w-px lg:before:bg-border/55",
                  )}
                >
                  <span className="stone-icon-tile mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[0.7rem] text-brand">
                    <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} aria-hidden />
                  </span>
                  <p className="mt-4 text-[0.8125rem] font-semibold leading-snug text-foreground sm:text-sm">
                    {feature.title}
                  </p>
                  <p className="mx-auto mt-2 max-w-[10.5rem] text-[0.75rem] leading-[1.4] text-muted-foreground sm:text-[0.8125rem]">
                    {feature.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </RevealOnView>
      </Container>
    </Section>
  );
}
