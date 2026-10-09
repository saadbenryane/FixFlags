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

  const analyze = (
    <Button variant="brand" size="sm" className={cn(mode === "mobileSheet" && "w-full")} asChild>
      <Link href="/#analyze" onClick={onNavigate}>Analyze</Link>
    </Button>
  );

  // While the session fetch is in flight, user is null and we render the
  // logged-out state. Most marketing visitors are logged out, so this avoids a
  // late CTA pop-in; a signed-in visitor sees a brief swap to their avatar.
  if (!user) {
    if (mode === "mobileTop") {
      return (
        <Link href="/sign-in" onClick={onNavigate} className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {CARE_HOME.signIn}
        </Link>
      );
    }

    return (
      <div className={cn("flex items-center gap-2", mode === "mobileSheet" && "flex-col items-stretch")}>
        {mode === "mobileSheet" ? <Button variant="outline" size="sm" className="w-full" asChild><Link href="/sign-in" onClick={onNavigate}>{CARE_HOME.signIn}</Link></Button> :
          <Link href="/sign-in" onClick={onNavigate} className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{CARE_HOME.signIn}</Link>}
        {analyze}
      </div>
    );
  }

  if (mode === "mobileSheet") {
    return <div className="flex flex-col items-stretch gap-2">
      <Button variant="outline" size="sm" className="w-full justify-center" asChild>
        <Link href="/dashboard" onClick={onNavigate}>Dashboard</Link>
      </Button>
      {analyze}
    </div>;
  }

  if (mode === "mobileTop") return <AvatarMenu user={user} />;

  return (
    <div className={cn("flex items-center gap-2", mode === "desktop" && "ml-2")}>
      <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Dashboard</Link>
      <AvatarMenu user={user} />
      {analyze}
    </div>
  );
}
