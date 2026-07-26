import Image from "next/image";
import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, Copy, RefreshCw } from "lucide-react";
import { ScoreRingGauge } from "@/components/report/ScoreRingGauge";
import { LANDING_PAGE } from "@/lib/marketing/copy";
import type { SampleDashboardPreview } from "@/lib/marketing/sample-dashboard-preview";
import { cn } from "@/lib/utils";

interface SampleReportDashboardMockProps {
  preview: SampleDashboardPreview;
  checksLabel: string;
  className?: string;
}

/** Decorative homepage mock: layout from marketing design, data from sample report only. */
export function SampleReportDashboardMock({
  preview,
  checksLabel,
  className,
}: SampleReportDashboardMockProps) {
  const copy = LANDING_PAGE.sampleReport.mock;
  const {
    host,
    score,
    checkedAtLabel,
    flagCount,
    rubricCounts,
    rubricScores,
    issues,
    selected,
  } = preview;

  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-card border border-border/30 bg-background",
        "shadow-glass-hero",
        className,
      )}
    >
      <div className="min-h-[32rem] sm:min-h-[36rem]">
        <MockHeader
          host={host}
          checkedAtLabel={checkedAtLabel}
          sampleFinishPlan={copy.sampleFinishPlan}
          share={copy.share}
          recheck={copy.recheck}
        />

        <div className="grid gap-3.5 border-b border-border/30 p-5 sm:grid-cols-3 sm:gap-4 sm:p-6">
          <SummaryCard>
            <p className="text-xs font-medium text-muted-foreground">
              {copy.highImpact}
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums leading-none text-foreground">
              {flagCount}
            </p>
            <p className="mt-2.5 text-xs font-medium text-destructive">
              {copy.needsAttention}
            </p>
            <p className="mt-3 inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-success" strokeWidth={2} />
              {checksLabel}
            </p>
          </SummaryCard>

          <SummaryCard>
            <div className="flex items-center gap-3.5">
              <ScoreRingGauge score={score} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {copy.releaseReadiness}
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums leading-none text-foreground">
                  {score == null ? "N/A" : score}
                  {score != null ? (
                    <span className="text-sm font-medium text-muted-foreground">
                      {copy.scoreDenom}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </SummaryCard>

          <SummaryCard>
            <p className="text-xs font-medium text-muted-foreground">
              {copy.byRubric}
            </p>
            <ul className="mt-3 space-y-2.5">
              {rubricScores.map((row) => (
                <li key={row.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      {row.label}
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {row.score == null ? "--" : row.score}
                    </span>
                  </div>
                  <RubricScoreBar score={row.score} />
                </li>
              ))}
            </ul>
          </SummaryCard>
        </div>

        <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,18.5rem)] lg:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border/30 pb-3.5">
              <MockTab active label={copy.allIssues(flagCount)} />
              <MockTab label={copy.messageTab(rubricCounts.message)} />
              <MockTab label={copy.experienceTab(rubricCounts.experience)} />
              <MockTab label={copy.reachTab(rubricCounts.reach)} />
            </div>

            <ul className="mt-3.5 space-y-1">
              {issues.map((issue, index) => (
                <li
                  key={issue.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2.5",
                    index === 0 ? "bg-brand/10" : undefined,
                  )}
                >
                  <MockSeverityMark severity={issue.severity} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {issue.title}
                  </span>
                  <span
                    className={cn(
                      "hidden shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold sm:inline",
                      severityTone(issue.severity),
                    )}
                  >
                    {issue.severityLabel.replace(/ Flag$/i, "")}
                  </span>
                  <span className="hidden shrink-0 rounded-full bg-muted/70 px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground sm:inline">
                    {issue.rubric}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              {copy.viewAll(flagCount)}
            </p>
          </div>

          {selected ? (
            <div className="rounded-[var(--radius-inner)] border border-border/40 bg-background p-5 shadow-raised">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {selected.title}
                </p>
                <span
                  className={cn(
                    "mt-2 inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-semibold",
                    severityTone(selected.severity),
                  )}
                >
                  {selected.severityLabel}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <DetailSection title={copy.whyItMatters}>
                  <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                    {selected.why}
                  </p>
                </DetailSection>

                {selected.impactLabels.length > 0 ? (
                  <DetailSection title={copy.impact}>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.impactLabels.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium text-foreground"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                ) : null}

                <DetailSection title={copy.fixPrompt}>
                  <div className="line-clamp-4 rounded-[var(--radius-control)] bg-muted/55 px-3.5 py-3 text-[0.6875rem] leading-relaxed text-foreground/80">
                    {selected.hasFixPrompt
                      ? selected.fixPrompt
                      : copy.fixPromptFallback}
                  </div>
                  <span className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-foreground text-xs font-semibold text-background">
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    {copy.copyPrompt}
                  </span>
                </DetailSection>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MockHeader({
  host,
  checkedAtLabel,
  sampleFinishPlan,
  share,
  recheck,
}: {
  host: string;
  checkedAtLabel: string | null;
  sampleFinishPlan: string;
  share: string;
  recheck: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/30 px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex min-w-0 items-start gap-3">
        <Image
          src="/brand/logo-mark.png"
          alt=""
          width={28}
          height={28}
          className="mt-0.5 h-7 w-7 shrink-0"
          unoptimized
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {host}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sampleFinishPlan}
            {checkedAtLabel ? ` · ${checkedAtLabel}` : null}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 items-center rounded-[var(--radius-control)] border border-border/55 bg-background px-3 text-xs font-medium text-muted-foreground">
          {share}
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border border-border/55 bg-background px-3 text-xs font-medium text-muted-foreground">
          <RefreshCw className="h-3 w-3" strokeWidth={2} />
          {recheck}
        </span>
      </div>
    </header>
  );
}

function SummaryCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-inner)] bg-muted/30 px-4 py-4 sm:px-4 sm:py-4">
      {children}
    </div>
  );
}

function RubricScoreBar({ score }: { score: number | null }) {
  const width = score == null ? 0 : Math.min(100, Math.max(0, score));
  return (
    <div className="h-1 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-brand/80"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/** FilterPill visual language without interactive button semantics (decorative mock). */
function MockTab({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 text-[0.6875rem] font-medium",
        active
          ? "bg-foreground text-background"
          : "bg-muted/50 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** SeveritySignal color language without tooltip chrome (decorative mock). */
function MockSeverityMark({ severity }: { severity: string }) {
  const normalized = severity.toUpperCase();
  const isCritical = normalized === "CRITICAL";
  const isImportant = normalized === "IMPORTANT";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        isCritical && "text-destructive",
        isImportant && "text-grade-D",
        !isCritical && !isImportant && "text-muted-foreground/70",
      )}
    >
      <CircleAlert className="h-4 w-4" strokeWidth={2.25} aria-hidden />
    </span>
  );
}

function severityTone(severity: string) {
  const normalized = severity.toUpperCase();
  if (normalized === "CRITICAL") return "text-destructive bg-destructive/10";
  if (normalized === "POLISH") return "text-muted-foreground bg-muted";
  return "text-brand bg-brand/10";
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-label text-muted-foreground">
        {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
