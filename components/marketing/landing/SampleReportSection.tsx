import Link from "next/link";
import {
  ChevronRight,
  Copy,
  Flag,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { HomepageReportPreview } from "@/components/marketing/landing/HomepageReportPreview";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { MarketingEyebrow } from "@/components/marketing/MarketingEyebrow";
import { rubricIcon } from "@/lib/rubric-icons";
import {
  SampleSectionCta,
  SampleViewTracker,
} from "@/components/marketing/landing/SampleFunnelEvents";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import type { CuratedSampleAudit } from "@/lib/marketing/curated-sample";
import { buildSampleReportDisplay } from "@/lib/marketing/sample-report-display";
import { getStaticSampleAudit } from "@/lib/marketing/static-sample";
import { LANDING_PAGE } from "@/lib/marketing/copy";
import { CHECK_ID_COUNT } from "@/lib/audit/check-ids";
import { buildCuratedSampleWorkspaceModel } from "@/lib/report/workspace-adapters";
import { cn } from "@/lib/utils";

interface SampleReportSectionProps {
  audit?: CuratedSampleAudit;
}

export function SampleReportSection({ audit }: SampleReportSectionProps) {
  const copy = LANDING_PAGE.sampleReport;
  const report = buildSampleReportDisplay(audit ?? getStaticSampleAudit());
  const workspace = buildCuratedSampleWorkspaceModel(report);
  const flagCount = report.flags.length;
  const metrics = [
    {
      id: "checks",
      ...copy.checksMetric(CHECK_ID_COUNT),
      icon: ShieldCheck,
    },
    {
      id: "flags",
      ...copy.issuesMetric(flagCount),
      icon: Flag,
    },
    ...copy.trustMetrics.map((metric) => ({
      ...metric,
      icon:
        metric.id === "updateReview"
            ? RefreshCw
            : metric.id === "fixPrompt"
              ? Copy
              : ScanSearch,
    })),
  ];

  const primaryMetrics = metrics.slice(0, 2);
  const supportingMetrics = metrics.slice(2);

  return (
    <>
      <Section
        spacing="marketing"
        tint="subtle"
        className="overflow-hidden py-14 sm:py-16 lg:py-20"
      >
        <SampleViewTracker placement="homepage" />
        <Container
          id="sample-review"
          className="scroll-mt-[calc(var(--header-height-marketing)+1rem)] px-4 sm:px-6 lg:px-12"
          variant="marketing"
        >
          <div className="grid items-center gap-10 xl:grid-cols-[minmax(18rem,0.58fr)_minmax(0,1.42fr)] xl:gap-12">
            <RevealOnView className="flex flex-col gap-5 sm:gap-6">
              <LandingSectionHeader
                align="left"
                label={copy.label}
                brandEyebrow
                headline={copy.headlineDisplay}
                accentPeriod={copy.headlineAccentPeriod}
                subhead={copy.body}
                size="lg"
                className="max-w-md space-y-4 sm:space-y-5"
              />

              <ul className="flex flex-col gap-1.5">
                {copy.rubricRows.map((row) => {
                  const Icon = rubricIcon(row.icon);
                  const count = report.flags.filter(
                    (flag) => flag.rubric.toLowerCase() === row.id,
                  ).length;
                  return (
                    <li key={row.id}>
                      <Link
                        href="/samples"
                        className={cn(
                          "group flex min-h-[4.25rem] items-center gap-3.5 rounded-[var(--radius-control)] px-1 py-2.5 sm:gap-4",
                          "transition-[background-color,transform] duration-200 ease-out",
                          "hover:bg-background/75",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                        )}
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-brand">
                          <Icon
                            className="h-5 w-5"
                            strokeWidth={1.7}
                            aria-hidden
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.9375rem] font-semibold text-foreground">
                            {row.title}
                          </span>
                          <span className="mt-1 block text-[0.8125rem] leading-snug text-muted-foreground text-pretty">
                            {row.body}
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-2 pl-1">
                          <span className="text-xs font-medium tabular-nums text-[hsl(var(--brand-strong))] dark:text-brand">
                            {count} {count === 1 ? "Flag" : "Flags"}
                          </span>
                          <ChevronRight
                            className="h-4 w-4 text-muted-foreground/70 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-foreground"
                            aria-hidden
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <SampleSectionCta flagCount={flagCount} />
            </RevealOnView>

            <RevealOnView className="min-w-0">
              <HomepageReportPreview model={workspace} />
            </RevealOnView>
          </div>
        </Container>
      </Section>

      <Section
        spacing="compact"
        className="relative overflow-hidden bg-foreground text-background"
      >
        <RevealOnView>
          <Container
            variant="marketing"
            className="px-4 py-14 sm:px-6 sm:py-16 lg:px-12 lg:py-20"
          >
            <div className="grid gap-10 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:items-stretch lg:gap-16">
              <div className="flex max-w-xl flex-col justify-between">
                <div>
                  <MarketingEyebrow
                    dot={false}
                    className="font-semibold text-brand"
                  >
                    {copy.trustLabel}
                  </MarketingEyebrow>
                  <h2 className="mt-5 max-w-[12ch] font-display text-3xl font-semibold leading-[1.06] tracking-display text-background text-balance sm:text-4xl lg:text-5xl">
                    {copy.trustHeadline}
                  </h2>
                </div>
                <p className="mt-7 max-w-md text-base leading-relaxed text-background/65 text-pretty">
                  {copy.trustBody}
                </p>
              </div>

              <div className="grid gap-3 sm:min-h-[19rem] sm:grid-cols-[1.18fr_0.82fr]">
                {primaryMetrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.id}
                      className={cn(
                        "group relative flex min-w-0 flex-col justify-between rounded-[var(--radius-inner)] bg-background/[0.055] p-6 sm:p-7",
                        index === 0 && "min-h-[16rem] sm:min-h-0",
                        index > 0 && "min-h-[13rem] sm:min-h-0",
                      )}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-medium leading-tight text-background/55">
                          {metric.label}
                        </span>
                        <Icon
                          className={cn(
                            "h-5 w-5 shrink-0",
                            metric.id === "flags"
                              ? "text-brand"
                              : "text-background/45",
                          )}
                          strokeWidth={1.65}
                          aria-hidden
                        />
                      </div>
                      <div
                        className={cn(
                          "mt-8 font-mono font-semibold tabular-nums tracking-[-0.055em] text-background",
                          index === 0
                            ? "text-6xl sm:text-7xl lg:text-[5.5rem]"
                            : "text-5xl sm:text-6xl",
                        )}
                      >
                        {metric.value}
                      </div>
                      {index === 0 ? (
                        <div
                          className="mt-7 h-1 w-14 rounded-full bg-brand"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 grid gap-5 rounded-card bg-background/[0.035] p-5 sm:grid-cols-[minmax(11rem,0.55fr)_minmax(0,1.45fr)] sm:items-center sm:gap-8 sm:p-6">
              <p className="font-mono text-xs font-semibold uppercase tracking-label text-background/60">
                {copy.trustSupportLabel}
              </p>
              <div className="grid gap-4 sm:grid-cols-3 sm:gap-0">
                {supportingMetrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.id}
                      className={cn(
                        "flex items-start gap-3",
                        index > 0 && "sm:pl-6",
                        index < supportingMetrics.length - 1 && "sm:pr-6",
                      )}
                    >
                      <Icon
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                        strokeWidth={1.7}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <span className="block font-mono text-sm font-semibold tabular-nums text-background">
                          {metric.value}
                        </span>
                        <span className="mt-1 block text-xs leading-snug text-background/58">
                          {metric.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Container>
        </RevealOnView>
      </Section>
    </>
  );
}
