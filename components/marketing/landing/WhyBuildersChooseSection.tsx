import {
  Code2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
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

  return (
    <Section
      spacing="marketing"
      id="why-fixflags"
      className="scroll-mt-[var(--header-offset)]"
    >
      <Container
        variant="marketing"
        className="space-y-10 px-4 sm:space-y-12 sm:px-6 lg:space-y-14 lg:px-12"
      >
        <RevealOnView>
          <LandingSectionHeader
            label={copy.label}
            brandEyebrow
            headline={copy.headlineDisplay}
            accentPeriod={copy.headlineAccentPeriod}
            subhead={copy.subhead}
          />
        </RevealOnView>

        <RevealOnView>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
            {copy.features.map((feature, index) => {
              const Icon = FEATURE_ICONS[feature.icon];
              return (
                <li
                  key={feature.id}
                  className={cn(
                    "space-y-3 px-4 text-center",
                    index > 0 && "lg:border-l lg:border-border/45",
                  )}
                >
                  <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-background text-brand shadow-card">
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {feature.title}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
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
