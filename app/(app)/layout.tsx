import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRequestedPath, signInUrl } from "@/lib/auth/redirect-path";
import { isAdminUser } from "@/lib/auth/permissions";
import { SiteShell } from "@/components/layout/site-shell";
import { BRAND } from "@/lib/marketing/copy";
import { getAppMeUser, getAppViewer } from "@/lib/auth/app-viewer";
import { MeProvider } from "@/hooks/useMe";

export const metadata: Metadata = {
  title: BRAND.name,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getAppViewer();
  if (!viewer) {
    redirect(signInUrl(await getRequestedPath("/dashboard")));
  }
  const showAdmin = isAdminUser(viewer.user);
  const initialUser = await getAppMeUser();

  return (
    <MeProvider initialUser={initialUser}>
      <SiteShell variant="app" showAdmin={showAdmin} showSupport={false}>
        {children}
      </SiteShell>
    </MeProvider>
  );
}
