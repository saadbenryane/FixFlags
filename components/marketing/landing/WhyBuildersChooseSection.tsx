import Image from "next/image";
import {
  Code2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { EditorToolMarks } from "@/components/marketing/landing/EditorToolMarks";
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
  const workflow = LANDING_PAGE.builderWorkflow;
  const [headlineLead, headlineTail = ""] = copy.headlineDisplay.split(". ");

  return (
    <Section
      spacing="compact"
      id="why-fixflags"
      className="scroll-mt-[var(--header-offset)] pb-6 pt-5 sm:pb-7 sm:pt-6 lg:pb-8 lg:pt-6"
    >
      <Container
        variant="marketing"
        className="space-y-6 px-4 sm:px-6 lg:space-y-6 lg:px-12"
      >
        <RevealOnView>
          <div className="mx-auto max-w-[58rem] space-y-2.5 text-center">
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
          <ul className="mx-auto grid max-w-[78rem] grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-y-6 lg:grid-cols-5 lg:gap-0">
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
                  <p className="mt-3 text-[0.8125rem] font-semibold leading-snug text-foreground sm:text-sm">
                    {feature.title}
                  </p>
                  <p className="mx-auto mt-1.5 max-w-[10.5rem] text-[0.75rem] leading-[1.35] text-muted-foreground sm:text-[0.8125rem]">
                    {feature.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </RevealOnView>

        <RevealOnView>
          <div className="grid overflow-hidden rounded-[1.35rem] bg-muted/20 shadow-card lg:grid-cols-[0.72fr_1.28fr]">
            <div className="flex flex-col justify-center px-6 py-6 sm:px-7 lg:px-7 lg:py-7">
              <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                {workflow.label}
              </p>
              <h3 className="mt-3 max-w-[16ch] font-display text-[1.6rem] font-semibold leading-[1.05] tracking-display text-foreground sm:text-[1.85rem]">
                {workflow.headlineDisplay}
                <span className="text-brand" aria-hidden>.</span>
              </h3>
              <p className="mt-2.5 max-w-[30rem] text-[0.8125rem] leading-relaxed text-muted-foreground text-pretty">
                {workflow.body}
              </p>
              <EditorToolMarks
                compact
                shortLabels
                showLabel={false}
                className="mt-4 [&_ul]:grid [&_ul]:grid-cols-2 [&_ul]:gap-1.5 [&_li]:min-h-8 [&_li]:rounded-[var(--radius-control)] [&_li]:border [&_li]:border-border/60 [&_li]:bg-background [&_li]:px-2.5 [&_li]:text-[0.6875rem] [&_li]:shadow-sm"
              />
            </div>

            <div className="relative min-h-[20rem] overflow-hidden border-t border-border/35 bg-background/65 lg:min-h-0 lg:border-l lg:border-t-0">
              <Image
                src="/marketing/visuals/builder-workflow-scene-v3.png"
                alt="A generated FixFlags workflow connecting Review, Flag, Fix, and Re-check to cleared Flags, improved release status, and confident shipping."
                width={1672}
                height={941}
                sizes="(min-width: 1024px) 58vw, 100vw"
                loading="lazy"
                className="absolute inset-0 h-full w-full select-none object-contain object-center"
                draggable={false}
              />
            </div>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  );
}
