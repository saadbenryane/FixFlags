import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { SiteWorkspaceFrame } from '@/components/sites/SiteWorkspaceFrame'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'

/** The route has not established Site access or any recorded results yet. */
export default function SiteLoading() {
  return <SiteWorkspaceFrame mobileHeader={<>
      <Logo variant="lockup" size="sm" href="/dashboard" />
      <Button asChild variant="ghost" size="sm"><Link href="/dashboard">{SYSTEM_COPY.actions.allSites}</Link></Button>
    </>}>
      <div className="space-y-6">
        <p role="status" className="text-sm text-muted-foreground">{SITE_ACTION_COPY.loading}</p>
        <div aria-hidden="true" className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-7 w-48 max-w-full animate-none" />
            <Skeleton className="h-4 w-32 animate-none" />
          </div>
          <Skeleton className="h-12 w-full max-w-lg animate-none rounded-control" />
          <Skeleton className="h-64 w-full animate-none rounded-card" />
        </div>
      </div>
  </SiteWorkspaceFrame>
}
