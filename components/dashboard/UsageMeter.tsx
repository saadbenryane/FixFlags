"use client";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { TextLink } from "@/components/ui/text-link";
import { Gauge, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_CENTER, UPSELLS } from "@/lib/marketing/copy";
import { checkUsageProgress } from "@/lib/audit/check-limit-utils";
import { planLabel } from "@/lib/billing/plans";
import {
  helpHrefForLimitAction,
  helpHrefForSurface,
} from "@/lib/help/contextual";

interface Props {
  used: number;
  limit: number | null;
  pending?: number;
  plan: string;
  purchasedCredits?: number;
  variant?: "compact" | "panel";
}

export function UsageMeter({
  used,
  limit,
  pending = 0,
  plan,
  purchasedCredits = 0,
  variant = "panel",
}: Props) {
  const isUnlimited = limit === null || limit === Infinity;
  const { atLimit, pct, reserved } = checkUsageProgress(
    used,
    pending,
    isUnlimited ? null : limit,
  );
  const nearLimit = !isUnlimited && pct >= 80;
  const showLimitHelp = !isUnlimited && (atLimit || nearLimit);
  const limitHelpHref =
    atLimit && plan === "FREE" && purchasedCredits === 0
      ? helpHrefForLimitAction("upgrade")
      : helpHrefForSurface("audit_limit");
  const remaining = !isUnlimited
    ? Math.max(0, limit - used - pending)
    : Infinity;
  const headline = isUnlimited
    ? `${used} this period`
    : `${remaining} remaining`;
  const detail = isUnlimited
    ? `product review${used === 1 ? "" : "s"} this period`
    : `product review${remaining === 1 ? "" : "s"} remaining`;

  if (variant === "compact") {
    return (
      <section
        aria-label="Product review usage"
        className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex min-w-0 items-center gap-2 sm:w-48">
          <Gauge
            className="h-4 w-4 shrink-0 text-brand"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-xs font-medium">Product reviews</p>
            <p className="font-mono text-sm font-semibold tabular-nums leading-tight">
              {headline}
            </p>
          </div>
        </div>
        {!isUnlimited ? (
          <Progress
            value={pct}
            aria-label={`${reserved} of ${limit} product reviews used`}
            className={cn(
              "h-1.5 sm:flex-1",
              atLimit && "bg-destructive/20 [&>div]:bg-destructive",
              nearLimit && !atLimit && "[&>div]:bg-brand",
            )}
          />
        ) : (
          <span className="hidden sm:block sm:flex-1" />
        )}
        <p className="text-xs text-muted-foreground sm:max-w-xs sm:text-right">
          {pending > 0
            ? `${pending} in progress. Update reviews use the same credits.`
            : "Update reviews use the same credits."}
          {atLimit && plan === "FREE" && purchasedCredits === 0 ? (
            <>
              {" "}
              <Link href="/pricing" className="text-brand hover:underline">
                Upgrade to Pro
              </Link>
            </>
          ) : null}
          {showLimitHelp ? (
            <>
              {" "}
              <TextLink href={limitHelpHref}>{HELP_CENTER.viewHelpCta}</TextLink>
            </>
          ) : null}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Product review usage" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Gauge
            className="h-4 w-4 text-brand"
            strokeWidth={1.75}
            aria-hidden
          />
          Product review usage
        </span>
        {plan !== "FREE" && !isUnlimited && (
          <span className="text-xs text-muted-foreground">
            {planLabel(plan)} plan
          </span>
        )}
      </div>

      <div>
        <p className="font-mono text-3xl font-semibold tabular-nums leading-none">
          {isUnlimited ? used : Math.max(0, remaining)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>

      {pending > 0 && (
        <p className="text-xs text-muted-foreground">
          {pending} AI report{pending !== 1 ? "s" : ""} in progress
        </p>
      )}

      {purchasedCredits > 0 && (
        <p className="text-xs text-muted-foreground">
          {purchasedCredits} purchased credit
          {purchasedCredits !== 1 ? "s" : ""} available
        </p>
      )}

      {!isUnlimited && (
        <Progress
          value={pct}
          className={cn(
            atLimit && "bg-destructive/20 [&>div]:bg-destructive",
            nearLimit && !atLimit && "[&>div]:bg-brand",
          )}
        />
      )}

      {!isUnlimited && plan === "FREE" && remaining > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {limit > 0 ? `${used + pending} of ${limit} product reviews used` : ""}
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
        <p className="text-xs text-muted-foreground">
          {UPSELLS.atLimit}{" "}
          <Link href="/pricing" className="text-brand hover:underline">
            Upgrade to Pro
          </Link>
          {" · "}
          <TextLink href={limitHelpHref}>{HELP_CENTER.viewHelpCta}</TextLink>
        </p>
      )}

      {atLimit && plan !== "FREE" && purchasedCredits === 0 && (
        <p className="text-xs text-muted-foreground">
          Plan limit reached. Upgrade for more product reviews.{" "}
          <TextLink href={limitHelpHref}>{HELP_CENTER.viewHelpCta}</TextLink>
        </p>
      )}

      {showLimitHelp && !atLimit && (
        <p className="text-xs text-muted-foreground">
          <TextLink href={limitHelpHref}>{HELP_CENTER.viewHelpCta}</TextLink>
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RotateCcw className="h-3.5 w-3.5 text-brand" aria-hidden />
        Update reviews use the same product review credits as new URLs.
      </div>
    </section>
  );
}
