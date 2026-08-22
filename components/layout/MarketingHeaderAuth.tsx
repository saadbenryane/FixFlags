"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/useMe";
import { HERO } from "@/lib/marketing/copy";
import { AvatarMenu } from "@/components/layout/AvatarMenu";
import { cn } from "@/lib/utils";

export function MarketingHeaderAuth({
  mode = "desktop",
  onNavigate,
}: {
  mode?: "desktop" | "mobileTop" | "mobileSheet";
  onNavigate?: () => void;
}) {
  const { user } = useMe();

  // While the session fetch is in flight, user is null and we render the
  // logged-out state. Most marketing visitors are logged out, so this avoids a
  // late CTA pop-in; a signed-in visitor sees a brief swap to their avatar.
  if (!user) {
    // Sheet: Log in only. Primary scan CTA stays in the mobile top bar so the
    // accessibility tree does not expose two Review CTAs when the menu opens.
    if (mode === "mobileSheet") {
      return (
        <Link
          href="/sign-in"
          onClick={onNavigate}
          className="flex min-h-11 min-w-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Log in
        </Link>
      );
    }

    // Keep both account access and the primary action visible in the compact
    // header so tablet and mobile visitors do not need to open the menu.
    if (mode === "mobileTop") {
      return (
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground max-[419px]:hidden sm:px-3"
          >
            Log in
          </Link>
          <Button
            variant="brand"
            size="sm"
            asChild
            className="rounded-[var(--radius-control)] px-4 font-semibold max-[419px]:px-2"
          >
            <Link href="/#audit" aria-label={HERO.primaryCta}>
              <span className="max-[419px]:hidden">{HERO.primaryCta}</span>
              <span className="hidden max-[419px]:inline" aria-hidden="true">
                {HERO.compactPrimaryCta}
              </span>
              <ArrowRight className="max-[419px]:hidden" />
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-3 sm:gap-4", "ml-3")}>
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 min-w-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Log in
        </Link>
        <span className="h-4 w-px bg-border/70" aria-hidden />
        <Button
          variant="brand"
          size="sm"
          asChild
          className="rounded-[var(--radius-control)] px-5 font-semibold"
        >
          <Link href="/#audit">
            {HERO.primaryCta}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  if (mode === "mobileSheet") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center"
        asChild
      >
        <Link href="/dashboard" onClick={onNavigate}>
          Dashboard
        </Link>
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center", mode === "desktop" && "ml-2")}>
      <AvatarMenu user={user} />
    </div>
  );
}
