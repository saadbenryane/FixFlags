'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { useMe } from '@/hooks/useMe'
import { AvatarMenu } from '@/components/layout/AvatarMenu'

/** Slim report header account slot: Log in or avatar. No second Review CTA. */
export function ReportHeaderAuth() {
  const { user } = useMe()
  const pathname = usePathname()
  const reportNext = /^\/report\/[^/]+/.test(pathname) ? pathname : null
  const href = reportNext
    ? `/sign-in?next=${encodeURIComponent(reportNext)}&from=report`
    : '/sign-in'

  if (!user) {
    return (
      <Link
        href={href as Route}
        className="inline-flex min-h-11 min-w-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Log in
      </Link>
    )
  }

  return <AvatarMenu user={user} />
}
