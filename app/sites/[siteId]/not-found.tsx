'use client'

import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'
import { Logo } from '@/components/brand/Logo'
import { SiteWorkspaceFrame } from '@/components/sites/SiteWorkspaceFrame'
import { SiteChromeAuth } from '@/components/sites/SiteChromeAuth'
import { Button } from '@/components/ui/button'
import { StatusPage } from '@/components/ui/status-page'
import { useMe } from '@/hooks/useMe'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { SYSTEM_COPY } from '@/lib/marketing/copy/errors'

/** Access refusals and absent records share one recovery without Site evidence. */
export default function SiteNotFound() {
  const params = useParams<{ siteId: string }>()
  const pathname = usePathname()
  const { user } = useMe()
  const siteHref = typeof params?.siteId === 'string' ? `/sites/${encodeURIComponent(params.siteId)}` : null
  const nested = Boolean(siteHref && pathname?.startsWith(`${siteHref}/`))
  return <SiteWorkspaceFrame mobileHeader={<Logo variant="lockup" size="sm" href="/dashboard" />}>
    <StatusPage title={SITE_WORKSPACE_COPY.unavailableTitle} description={SITE_WORKSPACE_COPY.unavailableBody} containerVariant="narrow">
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {!user ? <SiteChromeAuth /> : nested && siteHref ? <Button asChild><Link href={siteHref as Route}>{SYSTEM_COPY.actions.siteHome}</Link></Button> : null}
        <Button asChild variant={user && !nested ? 'default' : 'outline'}><Link href="/dashboard">{SYSTEM_COPY.actions.allSites}</Link></Button>
      </div>
    </StatusPage>
  </SiteWorkspaceFrame>
}
