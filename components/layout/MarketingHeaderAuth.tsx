"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/useMe";
import { CARE_HOME } from "@/lib/marketing/copy";
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
    return (
      <Link href="/sign-in" onClick={onNavigate} className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {CARE_HOME.signIn}
      </Link>
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
