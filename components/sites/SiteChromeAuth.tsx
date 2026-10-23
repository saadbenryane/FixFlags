'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSiteSignInHref } from '@/hooks/useSiteSignInHref'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { CARE_HOME } from '@/lib/marketing/copy-barrel'
import { cn } from '@/lib/utils'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export function SiteChromeAuth({
  className,
}: {
  className?: string
}) {
  return <Suspense fallback={<span className={cn('inline-flex min-h-11 items-center text-xs text-muted-foreground', className)} role="status">{SITE_ACTION_COPY.sessionPending}</span>}>
    <SiteChromeAuthContent className={className} />
  </Suspense>
}

function SiteChromeAuthContent({ className }: { className?: string }) {
  const { user, isLoading } = useMe()
  const signInHref = useSiteSignInHref()
  if (user) return null
  if (isLoading) return <span className={cn('inline-flex min-h-11 items-center text-xs text-muted-foreground', className)} role="status">{SITE_ACTION_COPY.sessionPending}</span>

  return (
    <Button variant="default" size="sm" className={cn(className)} asChild>
      <Link href={signInHref} data-site-return-focus="account">{CARE_HOME.signIn}</Link>
    </Button>
  )
}
