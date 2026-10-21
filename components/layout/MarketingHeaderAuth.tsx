"use client";

import { Suspense } from "react";
import type { Route } from "next";
import Link from "next/link";
import { PublicLink } from "@/components/marketing/public-site/PublicInteraction";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/useMe";
import { useSiteSignInHref } from "@/hooks/useSiteSignInHref";
import { AUTH } from "@/lib/marketing/copy/auth";
import { SITE_WORKSPACE_COPY } from "@/lib/marketing/copy/workspace";
import { AvatarMenu } from "@/components/layout/AvatarMenu";
import { cn } from "@/lib/utils";

type HeaderAuthProps = {
  mode?: "desktop" | "mobileTop" | "mobileSheet";
  onNavigate?: () => void;
};

function AnalyzeAction({ mode, onNavigate }: HeaderAuthProps) {
  return <Button variant="brand" size="sm" className={cn(mode === "mobileSheet" && "w-full")} asChild>
    <PublicLink href="/new" target="analyze" onClick={onNavigate}>Analyze</PublicLink>
  </Button>;
}

function SignedOutActions({ mode = "desktop", onNavigate, signInHref }: HeaderAuthProps & { signInHref: Route }) {
  const signIn = <Link prefetch={false} href={signInHref} onClick={onNavigate} className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{AUTH.signIn.cta}</Link>;
  if (mode === "mobileTop") return signIn;
  return <div className={cn("flex items-center gap-2", mode === "mobileSheet" && "flex-col items-stretch")}>
    {mode === "mobileSheet" ? <Button variant="outline" size="sm" className="w-full" asChild><Link prefetch={false} href={signInHref} onClick={onNavigate}>{AUTH.signIn.cta}</Link></Button> : signIn}
    <AnalyzeAction mode={mode} onNavigate={onNavigate} />
  </div>;
}

export function MarketingHeaderAuth(props: HeaderAuthProps) {
  return <Suspense fallback={<SignedOutActions {...props} signInHref="/sign-in" />}>
    <MarketingHeaderAuthContent {...props} />
  </Suspense>;
}

function MarketingHeaderAuthContent({ mode = "desktop", onNavigate }: HeaderAuthProps) {
  const { user } = useMe();
  const signInHref = useSiteSignInHref();
  if (!user) return <SignedOutActions mode={mode} onNavigate={onNavigate} signInHref={signInHref} />;
  if (mode === "mobileSheet") return <div className="flex flex-col items-stretch gap-2">
    <Button variant="outline" size="sm" className="w-full justify-center" asChild><Link prefetch={false} href="/dashboard" onClick={onNavigate}>{SITE_WORKSPACE_COPY.websites}</Link></Button>
    <AnalyzeAction mode={mode} onNavigate={onNavigate} />
  </div>;
  if (mode === "mobileTop") return <AvatarMenu user={user} />;
  return <div className={cn("flex items-center gap-2", mode === "desktop" && "ml-2")}><AvatarMenu user={user} /></div>;
}
