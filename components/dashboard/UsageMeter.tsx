"use client";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Gauge, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPSELLS } from "@/lib/marketing/copy";
import { checkUsageProgress } from "@/lib/audit/check-limit-utils";
import { planLabel } from "@/lib/billing/plans";

interface Props {
  used: number;
  limit: number | null;
  pending?: number;
  plan: string;
  purchasedCredits?: number;
}

export function UsageMeter({
  used,
  limit,
  pending = 0,
  plan,
  purchasedCredits = 0,
}: Props) {
  const isUnlimited = limit === null || limit === Infinity;
  const { atLimit, pct } = checkUsageProgress(
    used,
    pending,
    isUnlimited ? null : limit,
  );
  const nearLimit = !isUnlimited && pct >= 80;
  const remaining = !isUnlimited
    ? Math.max(0, limit - used - pending)
    : Infinity;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Gauge
              className="h-4 w-4 text-brand"
              strokeWidth={1.75}
              aria-hidden
            />
            Check usage
          </span>
          {plan !== "FREE" && !isUnlimited && (
            <span className="text-xs text-muted-foreground">
              {planLabel(plan)} plan
            </span>
          )}
        </div>

        <div className="mt-5">
          <p className="font-mono text-3xl font-semibold tabular-nums tracking-display">
            {isUnlimited ? used : Math.max(0, remaining)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isUnlimited
              ? `new URL check${used === 1 ? "" : "s"} this period`
              : `new URL check${remaining === 1 ? "" : "s"} remaining`}
          </p>
        </div>

        {pending > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {pending} AI report{pending !== 1 ? "s" : ""} in progress
          </p>
        )}

        {purchasedCredits > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {purchasedCredits} purchased credit
            {purchasedCredits !== 1 ? "s" : ""} available
          </p>
        )}

        {!isUnlimited && (
          <Progress
            value={pct}
            className={cn(
              "mt-4",
              atLimit && "bg-destructive/20 [&>div]:bg-destructive",
              nearLimit && !atLimit && "[&>div]:bg-brand",
            )}
          />
        )}

        {!isUnlimited && plan === "FREE" && remaining > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {limit > 0 ? `${used + pending} of ${limit} free checks used` : ""}
            {remaining === 1 && (
              <span>
                {" - "}
                <Link href="/pricing" className="text-brand hover:underline">
                  upgrade for more
                </Link>
              </span>
            )}
          </p>
        )}

        {atLimit && plan === "FREE" && purchasedCredits === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {UPSELLS.atLimit}{" "}
            <Link href="/pricing" className="text-brand hover:underline">
              Upgrade to Pro
            </Link>
          </p>
        )}

        {atLimit && plan !== "FREE" && purchasedCredits === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Plan limit reached.{" "}
            <Link
              href="/billing#credit-packs"
              className="text-brand hover:underline"
            >
              Buy +10 checks
            </Link>
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-5 text-xs text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5 text-brand" aria-hidden />
          Re-checks on reports you own stay free.
        </div>
      </CardContent>
    </Card>
  );
}
