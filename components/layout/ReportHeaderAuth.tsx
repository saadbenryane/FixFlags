'use client'

import Link from 'next/link'
import { useMe } from '@/hooks/useMe'
import { AvatarMenu } from '@/components/layout/AvatarMenu'

/** Slim report header account slot: Log in or avatar. No second Review CTA. */
export function ReportHeaderAuth() {
  const { user } = useMe()

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="inline-flex min-h-11 min-w-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Log in
      </Link>
    )
  }

  return <AvatarMenu user={user} />
}
