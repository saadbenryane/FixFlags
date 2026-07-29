import Link from "next/link";
import {
  ChevronRight,
  Flag,
  LockKeyhole,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { HomepageReportPreview } from "@/components/marketing/landing/HomepageReportPreview";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
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
        metric.id === "speed"
          ? Timer
          : metric.id === "recheck"
            ? RefreshCw
            : metric.id === "private"
              ? LockKeyhole
              : ScanSearch,
    })),
  ];

  const primaryMetrics = metrics.slice(0, 3);
  const supportingMetrics = metrics.slice(3);

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

              <ul className="flex flex-col divide-y divide-border/45">
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
                          <span className="text-[0.6875rem] font-medium tabular-nums text-brand/70">
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
        className="overflow-hidden bg-foreground text-background"
      >
        <RevealOnView>
          <Container
            variant="marketing"
            className="px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10"
          >
            <div className="grid gap-8 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)] lg:items-end lg:gap-12">
              <div className="max-w-lg">
                <p className="font-mono text-3xs font-semibold uppercase tracking-[0.18em] text-brand sm:text-2xs">
                  {copy.trustLabel}
                </p>
                <h2 className="mt-3 font-display text-2xl font-semibold leading-heading tracking-display text-background sm:text-3xl">
                  {copy.trustHeadline}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-background/62 text-pretty">
                  {copy.trustBody}
                </p>
              </div>

              <dl className="grid grid-cols-3">
                {primaryMetrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.id}
                      className={cn(
                        "min-w-0 py-1",
                        index > 0 &&
                          "border-l border-background/15 pl-4 sm:pl-6",
                      )}
                    >
                      <dt className="flex items-center gap-2 text-[0.6875rem] leading-tight text-background/55 sm:text-xs">
                        <Icon
                          className={cn(
                            "hidden h-4 w-4 shrink-0 sm:block",
                            metric.id === "flags"
                              ? "text-brand"
                              : "text-background/70",
                          )}
                          strokeWidth={1.7}
                          aria-hidden
                        />
                        {metric.label}
                      </dt>
                      <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-background sm:text-3xl lg:text-4xl">
                        {metric.value}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-background/15 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <p className="font-mono text-3xs font-semibold uppercase tracking-[0.16em] text-background/45 sm:text-2xs">
                {copy.trustSupportLabel}
              </p>
              <dl className="flex flex-wrap gap-x-6 gap-y-3 sm:justify-end">
                {supportingMetrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div key={metric.id} className="flex items-center gap-2.5">
                      <Icon
                        className="h-4 w-4 shrink-0 text-brand"
                        strokeWidth={1.7}
                        aria-hidden
                      />
                      <div className="flex flex-col">
                        <dt className="order-2 mt-0.5 text-2xs text-background/50">
                          {metric.label}
                        </dt>
                        <dd className="order-1 font-mono text-xs font-semibold tabular-nums text-background">
                          {metric.value}
                        </dd>
                      </div>
                    </div>
                  );
                })}
              </dl>
            </div>
          </Container>
        </RevealOnView>
      </Section>
    </>
  );
}
