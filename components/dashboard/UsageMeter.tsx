"use client";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { TextLink } from "@/components/ui/text-link";
import { Gauge, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_CENTER, UPSELLS, USAGE_METER_COPY } from "@/lib/marketing/copy";
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
  /** When false, omit inline upgrade links (page already has an upgrade CTA). */
  showUpgradeCta?: boolean;
}

export function UsageMeter({
  used,
  limit,
  pending = 0,
  plan,
  purchasedCredits = 0,
  variant = "panel",
  showUpgradeCta = true,
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
  const copy = USAGE_METER_COPY;
  const compactHeadline = isUnlimited
    ? String(used)
    : copy.usedOfLimit(reserved, limit);

  if (variant === "compact") {
    return (
      <section
        aria-label={copy.regionLabel}
        className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex min-w-0 items-center gap-2 sm:w-48">
          <Gauge
            className="h-4 w-4 shrink-0 text-brand"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-xs font-medium">{copy.compactLabel}</p>
            <p className="font-mono text-sm font-semibold tabular-nums leading-tight">
              {compactHeadline}
            </p>
          </div>
        </div>
        {!isUnlimited ? (
          <Progress
            value={pct}
            aria-label={copy.progressLabel(reserved, limit)}
            className={cn(
              "h-1.5 sm:flex-1",
              atLimit && "bg-destructive/20 [&>div]:bg-destructive",
              nearLimit && !atLimit && "[&>div]:bg-brand",
            )}
          />
        ) : (
          <span className="hidden sm:block sm:flex-1" />
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:max-w-xs sm:justify-end sm:text-right">
          {pending > 0 ? <span>{copy.pending(pending)}</span> : null}
          {showUpgradeCta && atLimit && plan === "FREE" && purchasedCredits === 0 ? (
            <Link href="/pricing" className="text-brand hover:underline">
              {copy.upgradeToPro}
            </Link>
          ) : null}
          {showLimitHelp ? (
            <TextLink href={limitHelpHref}>{HELP_CENTER.viewHelpCta}</TextLink>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section aria-label={copy.regionLabel} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="inline-flex items-center gap-2 text-sm font-medium">
          <Gauge
            className="h-4 w-4 text-brand"
            strokeWidth={1.75}
            aria-hidden
          />
          {copy.panelLabel}
        </h3>
        {plan !== "FREE" && !isUnlimited && (
          <span className="text-xs text-muted-foreground">
            {planLabel(plan)} plan
          </span>
        )}
      </div>

      {isUnlimited ? (
        <div>
          <p className="font-mono text-3xl font-semibold tabular-nums leading-none">
            {used}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {copy.usedThisMonthCaption(used)}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="font-mono text-3xl font-semibold tabular-nums leading-none">
              {copy.usedOfLimit(reserved, limit)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.usedCaption}
            </p>
          </div>
          <Progress
            value={pct}
            aria-label={copy.progressLabel(reserved, limit)}
            className={cn(
              "h-2.5",
              atLimit && "bg-destructive/20 [&>div]:bg-destructive",
              nearLimit && !atLimit && "[&>div]:bg-brand",
            )}
          />
        </div>
      )}

      {pending > 0 && (
        <p className="text-xs text-muted-foreground">{copy.pending(pending)}</p>
      )}

      {purchasedCredits > 0 && (
        <p className="text-xs text-muted-foreground">
          {copy.purchasedCredits(purchasedCredits)}
        </p>
      )}

      {showUpgradeCta && !isUnlimited && plan === "FREE" && remaining === 1 && (
        <p className="text-xs text-muted-foreground">
          <Link href="/pricing" className="text-brand hover:underline">
            {copy.upgradeForMore}
          </Link>
        </p>
      )}

      {atLimit && plan === "FREE" && purchasedCredits === 0 && (
        <p className="text-xs text-muted-foreground">
          {showUpgradeCta ? (
            <>
              {UPSELLS.atLimit}{" "}
              <Link href="/pricing" className="text-brand hover:underline">
                {copy.upgradeToPro}
              </Link>
              {" · "}
            </>
          ) : (
            <>{copy.limitReached}{" "}</>
          )}
          <TextLink href={limitHelpHref}>{HELP_CENTER.viewHelpCta}</TextLink>
        </p>
      )}

      {atLimit && plan !== "FREE" && purchasedCredits === 0 && (
        <p className="text-xs text-muted-foreground">
          {copy.paidLimitReached}{" "}
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
        {copy.panelNote}
      </div>
    </section>
  );
}
