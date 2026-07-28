"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreDisplay } from "@/components/audit/ScoreDisplay";
import { ScoreSparkline } from "@/components/audit/ScoreSparkline";
import { SectionTitle } from "@/components/ui/typography";
import {
  ArrowRight,
  ArrowLeftRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditItem {
  id: string;
  url: string;
  status: string;
  score: number | null;
  createdAt: string | Date;
  rubrics: Array<{
    name: string;
    grade: string | null;
    score: number | null;
    flags: Array<{ severity: string }>;
  }>;
  monitoringAudits: Array<{
    id: string;
    score: number | null;
    createdAt: string | Date;
  }>;
}

interface RecentChecksListProps {
  audits: AuditItem[];
  initialHasMore: boolean;
}

export function RecentChecksList({
  audits: initialAudits,
  initialHasMore,
}: RecentChecksListProps) {
  const [audits, setAudits] = useState(initialAudits);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadError, setLoadError] = useState(false);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setLoadError(false);
    const cursor = audits[audits.length - 1]?.id;
    try {
      const res = await fetch(`/api/recent-checks?cursor=${cursor}`);
      if (!res.ok) throw new Error("Failed to load more");
      const data = await res.json();
      setAudits((prev) => [...prev, ...data.audits]);
      setHasMore(data.hasMore);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <SectionTitle>Recent checks</SectionTitle>
        <p className="text-xs text-muted-foreground">
          Open a report to continue fixing.
        </p>
      </div>
      {audits.map((audit) => {
        const isCompleted = audit.status === "COMPLETED";
        const statusLabel =
          audit.status === "FAILED"
            ? "Failed"
            : audit.status === "COMPLETED"
              ? null
              : "In progress";

        const trendScores = isCompleted
          ? [audit.score, ...audit.monitoringAudits.map((r) => r.score)].filter(
              (s): s is number => s !== null,
            )
          : [];

        const criticalFlags = isCompleted
          ? audit.rubrics.flatMap((r) =>
              r.flags.filter((f) => f.severity === "CRITICAL"),
            ).length
          : 0;
        const importantFlags = isCompleted
          ? audit.rubrics.flatMap((r) =>
              r.flags.filter((f) => f.severity === "IMPORTANT"),
            ).length
          : 0;

        return (
          <Link
            key={audit.id}
            href={`/report/${audit.id}`}
            className="block group"
          >
            <Card interactive>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {isCompleted && (
                    <div className="shrink-0">
                      <ScoreDisplay
                        score={audit.score}
                        grade={null}
                        variant="compact"
                        size="sm"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="max-w-full truncate text-sm font-semibold">
                        {audit.url}
                      </span>
                      {statusLabel ? (
                        <Badge
                          variant={
                            audit.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                          }
                          size="sm"
                          className={
                            audit.status !== "FAILED"
                              ? "text-muted-foreground"
                              : undefined
                          }
                        >
                          {statusLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium">Original check</span>
                      <span>
                        {new Date(audit.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {criticalFlags > 0 && (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {criticalFlags} critical
                        </span>
                      )}
                      {importantFlags > 0 && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          {importantFlags} important
                        </span>
                      )}
                    </div>
                    {trendScores.length > 1 && (
                      <div className="mt-2 flex items-center gap-2">
                        <ScoreSparkline
                          scores={trendScores}
                          width={92}
                          height={28}
                        />
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <ArrowLeftRight className="h-3 w-3" aria-hidden />
                          {audit.monitoringAudits.length} re-check
                          {audit.monitoringAudits.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    )}
                  </div>
                  {audit.monitoringAudits.length > 0 &&
                  trendScores.length <= 1 ? (
                    <Badge
                      variant="outline"
                      size="sm"
                      className="w-fit gap-1 text-muted-foreground"
                    >
                      <ArrowLeftRight className="h-3 w-3" aria-hidden />
                      {audit.monitoringAudits.length} re-check
                      {audit.monitoringAudits.length === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                  <span className="inline-flex min-h-11 shrink-0 items-center gap-1 self-end text-xs font-semibold text-foreground sm:self-auto">
                    {isCompleted ? "Open fixes" : "Open report"}
                    <ArrowRight className="h-3.5 w-3.5 text-brand transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
      {hasMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          {loadError && (
            <p className="text-xs text-destructive">
              Failed to load more checks.
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
