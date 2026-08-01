import { CircleAlert, Flag, History } from "lucide-react";
import { RubricBar } from "@/components/audit/RubricBar";
import { ScoreHistoryChart } from "@/components/report/ScoreHistoryChart";
import { ScoreRingGauge } from "@/components/report/ScoreRingGauge";
import { REPORT_COPY } from "@/lib/marketing/copy";
import type { ReportWorkspaceModel } from "@/lib/report/workspace-model";
import { cn } from "@/lib/utils";

export function ReportWorkspaceOutcome({
  model,
  compact = false,
  className,
}: {
  model: ReportWorkspaceModel;
  compact?: boolean;
  className?: string;
}) {
  const unresolved = model.outcome.unresolvedCount;

  return (
    <header className={cn("space-y-2", className)}>
      <h2
        className={cn(
          "font-sans font-semibold tracking-heading text-balance text-foreground",
          compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
        )}
      >
        {REPORT_COPY.workspace.heading}
      </h2>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">
        {model.context.loading
          ? REPORT_COPY.workspace.checkingScope
          : REPORT_COPY.workspace.context({
              unresolved,
              checkedScope: model.outcome.checkedScope,
            })}
      </p>
    </header>
  );
}

export function ReportWorkspaceSummary({
  model,
  className,
  reportHref = "",
  compact = false,
  scanProgress,
  stageDetail,
}: {
  model: ReportWorkspaceModel;
  className?: string;
  reportHref?: string;
  compact?: boolean;
  /** Determinate scan progress (0-100) while loading. */
  scanProgress?: number;
  /** Honest stage detail shown under the score ring during loading. */
  stageDetail?: string | null;
}) {
  const rubrics = model.summary.rubrics.map((rubric) => ({
    name: rubric.name,
    flagCount: rubric.flagCount,
    criticalCount: rubric.criticalCount,
  }));
  const history =
    model.summary.history ??
    (model.summary.score != null && model.identity.checkedAt
      ? [
          {
            id: model.identity.auditId ?? "current-scan",
            score: model.summary.score,
            checkedAt: model.identity.checkedAt,
          },
        ]
      : []);
  const firstCritical = model.explorer.flags.find(
    (flag) => flag.severity === "CRITICAL",
  );
  const firstCriticalIds = Object.fromEntries(
    model.summary.rubrics.flatMap((rubric) => {
      const flag = model.explorer.flags.find(
        (candidate) =>
          candidate.rubric === rubric.name && candidate.severity === "CRITICAL",
      );
      return flag ? [[rubric.name, flag.id]] : [];
    }),
  );
  const criticalHref = firstCritical
    ? `${reportHref}?severity=CRITICAL&flag=${encodeURIComponent(firstCritical.id)}#report-flags`
    : undefined;

  return (
    <section
      id="report-status"
      aria-label={REPORT_COPY.workspace.summaryLabel}
      className={cn(
        "scroll-mt-[var(--report-chrome-offset)] overflow-hidden rounded-card bg-card/80 shadow-card glass-surface",
        className,
      )}
    >
      <div
        className={cn(
          "grid",
          compact
            ? "sm:grid-cols-[minmax(9rem,0.8fr)_minmax(8rem,0.65fr)_minmax(14rem,1.35fr)]"
            : "lg:grid-cols-[minmax(12rem,0.78fr)_minmax(10rem,0.62fr)_minmax(20rem,1.6fr)]",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-4",
            compact ? "min-h-28 p-3 sm:p-4" : "min-h-32 p-4 sm:p-5",
          )}
        >
          <ScoreRingGauge
            score={model.summary.score}
            loading={model.context.loading}
            progress={model.context.loading ? scanProgress : undefined}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
              {REPORT_COPY.workspace.releaseScore}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {model.summary.score == null
                ? model.context.loading
                  ? stageDetail ?? REPORT_COPY.reportFirst.checkingLabel
                  : REPORT_COPY.workspace.scoreUnavailable
                : REPORT_COPY.workspace.scoreOutOfHundred(model.summary.score)}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col justify-center border-t border-border/35",
            compact
              ? "min-h-28 p-3 sm:border-l sm:border-t-0 sm:p-4"
              : "min-h-32 p-4 sm:p-5 lg:border-l lg:border-t-0",
          )}
        >
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" aria-hidden />
            <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
              {REPORT_COPY.workspace.unresolvedFlags}
            </p>
          </div>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums leading-none text-foreground">
            {model.context.loading
              ? REPORT_COPY.reportFirst.checkingLabel
              : model.outcome.unresolvedCount}
          </p>
          {model.context.loading ? null : model.outcome.criticalCount > 0 &&
            criticalHref ? (
            <a
              href={criticalHref}
              aria-label={REPORT_COPY.workspace.showCriticalFlags(
                model.outcome.criticalCount,
              )}
              className="mt-2 inline-flex min-h-7 items-center gap-1.5 self-start text-xs font-medium text-destructive transition-colors hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <CircleAlert className="h-3.5 w-3.5" aria-hidden />
              {REPORT_COPY.workspace.criticalCount(model.outcome.criticalCount)}
            </a>
          ) : (
            <p
              aria-label={REPORT_COPY.workspace.criticalCount(0)}
              className="mt-2 text-xs font-medium text-success"
            >
              {REPORT_COPY.workspace.noCriticalFlags}
            </p>
          )}
        </div>

        <div
          className={cn(
            "border-t border-border/35",
            compact
              ? "min-h-28 p-3 sm:border-l sm:border-t-0 sm:p-4"
              : "min-h-32 p-4 sm:p-5 lg:border-l lg:border-t-0",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
                  {REPORT_COPY.workspace.history}
                </p>
                <p className="mt-0.5 text-xs font-medium text-foreground">
                  {history.length > 1
                    ? REPORT_COPY.workspace.scanCount(history.length)
                    : REPORT_COPY.workspace.firstScan}
                </p>
              </div>
            </div>
          </div>
          {history.length > 0 ? (
            <ScoreHistoryChart
              history={history}
              className={cn("mt-2.5 w-full", compact ? "h-16" : "h-20")}
            />
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">
              {REPORT_COPY.workspace.historyUnavailable}
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0 border-t border-border/35">
        <RubricBar
          rubrics={rubrics}
          firstCriticalIds={firstCriticalIds}
          loading={model.context.loading}
          reportHref={reportHref}
        />
      </div>

      {model.context.loading && typeof scanProgress === "number" ? (
        <div
          className="border-t border-border/35 px-4 pb-4 pt-3 sm:px-5"
          role="status"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {stageDetail ?? REPORT_COPY.reportFirst.checkingLabel}
            </span>
            <span className="font-mono tabular-nums">{scanProgress}%</span>
          </div>
          <div
            className="h-0.5 w-full overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
              style={{ width: `${Math.min(100, Math.max(0, scanProgress))}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Unified progress band for loading and completed report states. */
export const ReportProgressBand = ReportWorkspaceSummary;
