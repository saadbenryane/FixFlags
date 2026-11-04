'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { Route } from 'next'
import { RouteErrorPage, type RouteErrorBoundaryProps } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'
import { SiteWorkspaceFrame } from '@/components/sites/SiteWorkspaceFrame'
import { Logo } from '@/components/brand/Logo'

export default function SiteError({
  error,
  reset,
  retry,
}: RouteErrorBoundaryProps) {
  const params = useParams<{ siteId: string }>()
  const siteId = typeof params?.siteId === 'string' ? params.siteId : null
  const siteHref = siteId ? (`/sites/${encodeURIComponent(siteId)}` as Route) : null

  return (
    <SiteWorkspaceFrame mobileHeader={<Logo variant="lockup" size="sm" href="/dashboard" />}>
    <RouteErrorPage
      error={error}
      reset={reset}
      retry={retry}
      event="ui.site.error"
      title={SYSTEM_COPY.errors.site.title}
      description={SYSTEM_COPY.errors.site.body}
      returnHref={siteHref ?? '/dashboard'}
      returnLabel={siteHref ? SYSTEM_COPY.actions.siteHome : SYSTEM_COPY.actions.allSites}
      shell="none"
    >
      {siteHref ? (
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          {SYSTEM_COPY.actions.allSites}
        </Link>
      ) : null}
    </RouteErrorPage>
    </SiteWorkspaceFrame>
  )
}
