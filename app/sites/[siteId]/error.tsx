'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { Route } from 'next'
import { RouteErrorPage } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams<{ siteId: string }>()
  const siteId = typeof params?.siteId === 'string' ? params.siteId : null
  const siteHref = siteId ? (`/sites/${encodeURIComponent(siteId)}` as Route) : null

  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      event="ui.site.error"
      title={SYSTEM_COPY.errors.site.title}
      description={SYSTEM_COPY.errors.site.body}
      returnHref={siteHref ?? '/dashboard'}
      returnLabel={siteHref ? SYSTEM_COPY.actions.siteHome : SYSTEM_COPY.actions.allSites}
      shell="app"
    >
      {siteHref ? (
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          {SYSTEM_COPY.actions.allSites}
        </Link>
      ) : null}
    </RouteErrorPage>
  )
}
