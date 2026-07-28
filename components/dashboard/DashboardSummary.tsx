import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRingGauge } from "@/components/report/ScoreRingGauge";
import { ScoreSparkline } from "@/components/audit/ScoreSparkline";
import { rubricLabel } from "@/lib/utils";

interface RubricScore {
  name: string;
  grade: string | null;
  score: number | null;
}

interface DashboardSummaryProps {
  latestScore: number | null;
  latestReportId: string | null;
  criticalFlags: number;
  importantFlags: number;
  trendScores: number[];
  rubricScores?: RubricScore[];
}

export function DashboardSummary({
  latestScore,
  latestReportId,
  criticalFlags,
  importantFlags,
  trendScores,
  rubricScores = [],
}: DashboardSummaryProps) {
  const highImpactFlags = criticalFlags + importantFlags;
  const hasHistory = latestReportId !== null;
  const hasRubrics = rubricScores.length > 0;

  return (
    <section aria-labelledby="release-overview-heading">
      <h2 id="release-overview-heading" className="sr-only">
        Release overview
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Latest readiness</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4 pb-5">
            <ScoreRingGauge score={latestScore} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {latestScore == null
                  ? "No completed check yet"
                  : "Latest completed check"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {latestScore == null
                  ? "Review a URL to establish your release baseline."
                  : "Open the report to continue fixing what matters."}
              </p>
              {latestReportId ? (
                <Link
                  href={`/report/${latestReportId}`}
                  className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-foreground hover:text-brand"
                >
                  Open report
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">High-impact Flags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-5">
            <div className="flex items-end justify-between gap-4">
              <span className="font-mono text-4xl font-semibold tabular-nums tracking-display">
                {highImpactFlags}
              </span>
              {highImpactFlags > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Needs attention
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Clear
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <strong className="font-medium text-foreground tabular-nums">
                  {criticalFlags}
                </strong>{" "}
                critical
              </span>
              <span>
                <strong className="font-medium text-foreground tabular-nums">
                  {importantFlags}
                </strong>{" "}
                important
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By rubric</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {hasRubrics ? (
              <ul className="space-y-3">
                {rubricScores.map((rubric) => (
                  <li key={rubric.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        {rubricLabel(rubric.name)}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {rubric.score == null ? "--" : rubric.score}
                        {rubric.grade ? (
                          <span className="ml-1 text-foreground/70">
                            {rubric.grade}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand/80"
                        style={{
                          width: `${rubric.score == null ? 0 : Math.min(100, Math.max(0, rubric.score))}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Complete a check to see Message, Experience, and Reach scores.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 h-full overflow-hidden">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm">Score over time</CardTitle>
          <TrendingUp className="h-4 w-4 text-brand" aria-hidden />
        </CardHeader>
        <CardContent className="pb-5">
          {hasHistory && trendScores.length > 1 ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-[var(--radius-control)] bg-muted/25 px-3 py-4">
                <ScoreSparkline
                  scores={trendScores}
                  width={320}
                  height={70}
                  responsive
                  className="h-[70px] w-full"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Original check</span>
                <span>
                  {trendScores.length - 1} re-check
                  {trendScores.length - 1 === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[7.25rem] items-center justify-center rounded-[var(--radius-control)] bg-muted/25 px-5 text-center">
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Re-check after a fix to see progress here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
