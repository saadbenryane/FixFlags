import Image from "next/image";
import {
  CheckCircle2,
  Code2,
  Flag,
  Gem,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
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

const WORKFLOW_INPUT_ICONS = [SearchCheck, Flag, Wrench, RefreshCw] as const;
const WORKFLOW_OUTCOME_ICONS = [CheckCircle2, TrendingUp, Gem] as const;

export function WhyBuildersChooseSection() {
  const copy = LANDING_PAGE.whyBuildersChoose;
  const workflow = LANDING_PAGE.builderWorkflow;
  const [headlineLead, headlineTail = ""] = copy.headlineDisplay.split(". ");

  return (
    <Section
      spacing="compact"
      id="why-fixflags"
      className="scroll-mt-[var(--header-offset)] pb-8 pt-8 sm:pb-10 sm:pt-9 lg:pb-12 lg:pt-10"
    >
      <Container
        variant="marketing"
        className="space-y-9 px-4 sm:px-6 lg:space-y-10 lg:px-12"
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

        <RevealOnView>
          <div className="grid overflow-hidden rounded-[1.35rem] bg-muted/20 shadow-card lg:grid-cols-[0.72fr_1.28fr]">
            <div className="flex flex-col justify-center px-6 py-8 sm:px-8 lg:px-8 lg:py-9">
              <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                {workflow.label}
              </p>
              <h3 className="mt-4 max-w-[16ch] font-display text-[1.75rem] font-semibold leading-[1.05] tracking-display text-foreground sm:text-[2rem]">
                {workflow.headlineDisplay}
                <span className="text-brand" aria-hidden>.</span>
              </h3>
              <p className="mt-3 max-w-[30rem] text-sm leading-relaxed text-muted-foreground text-pretty">
                {workflow.body}
              </p>
              <EditorToolMarks
                compact
                shortLabels
                showLabel={false}
                className="mt-5 [&_ul]:grid [&_ul]:grid-cols-2 [&_ul]:gap-2 [&_li]:min-h-9 [&_li]:rounded-[var(--radius-control)] [&_li]:border [&_li]:border-border/60 [&_li]:bg-background [&_li]:px-2.5 [&_li]:text-[0.6875rem] [&_li]:shadow-sm"
              />
            </div>

            <div className="relative min-h-[22rem] overflow-hidden border-t border-border/35 bg-background/65 lg:min-h-0 lg:border-l lg:border-t-0">
              <Image
                src="/marketing/visuals/builder-workflow-scene-v2.webp"
                alt=""
                width={1672}
                height={941}
                sizes="(min-width: 1024px) 58vw, 100vw"
                loading="lazy"
                className="absolute inset-0 h-full w-full select-none object-contain object-center"
                draggable={false}
              />

              <ul className="absolute left-[4%] top-1/2 hidden w-[22%] -translate-y-1/2 space-y-2.5 sm:block">
                {workflow.inputs.map((label, index) => {
                  const Icon = WORKFLOW_INPUT_ICONS[index]!
                  return (
                    <li
                      key={label}
                      className="flex min-h-10 items-center gap-2 rounded-[0.65rem] border border-border/50 bg-background/90 px-3 text-[0.6875rem] font-semibold text-foreground shadow-card backdrop-blur-sm"
                    >
                      <Icon className="h-3.5 w-3.5 text-foreground/75" strokeWidth={1.8} aria-hidden />
                      {label}
                    </li>
                  )
                })}
              </ul>

              <ul className="absolute right-[3%] top-1/2 hidden w-[25%] -translate-y-1/2 space-y-3 sm:block">
                {workflow.outcomes.map((label, index) => {
                  const Icon = WORKFLOW_OUTCOME_ICONS[index]!
                  return (
                    <li
                      key={label}
                      className="flex min-h-11 items-center gap-2 rounded-[0.65rem] border border-border/50 bg-background/90 px-3 text-[0.6875rem] font-semibold leading-tight text-foreground shadow-card backdrop-blur-sm"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={1.8} aria-hidden />
                      <span>{label}</span>
                      <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                    </li>
                  )
                })}
              </ul>

              <div className="absolute inset-x-5 bottom-5 grid grid-cols-2 gap-2 sm:hidden">
                {[...workflow.inputs.slice(0, 2), ...workflow.outcomes.slice(0, 2)].map((label) => (
                  <span
                    key={label}
                    className="rounded-[0.6rem] border border-border/50 bg-background/90 px-2.5 py-2 text-center text-[0.625rem] font-semibold text-foreground shadow-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  );
}
