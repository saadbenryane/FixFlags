'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSiteSignInHref } from '@/hooks/useSiteSignInHref'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { CARE_HOME } from '@/lib/marketing/copy-barrel'
import { cn } from '@/lib/utils'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { useReportAuthGate } from '@/components/auth/ReportAuthGate'
import { UserRound, Loader2 } from 'lucide-react'

function SessionPending({ iconOnly, className }: { iconOnly: boolean; className?: string }) {
  return <span className={cn('inline-flex min-h-11 items-center text-xs text-muted-foreground', iconOnly && 'w-11 justify-center', className)} role="status">
    {iconOnly ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}<span className={iconOnly ? 'sr-only' : undefined}>{SITE_ACTION_COPY.sessionPending}</span>
  </span>
}

export function SiteChromeAuth({
  className,
  iconOnly = false,
}: {
  className?: string
  iconOnly?: boolean
}) {
  return <Suspense fallback={<SessionPending iconOnly={iconOnly} className={className} />}>
    <SiteChromeAuthContent className={className} iconOnly={iconOnly} />
  </Suspense>
}

function SiteChromeAuthContent({ className, iconOnly }: { className?: string; iconOnly: boolean }) {
  const { user, isLoading } = useMe()
  const gate = useReportAuthGate()
  const signInHref = useSiteSignInHref()
  if (user) return null
  if (isLoading) return <SessionPending iconOnly={iconOnly} className={className} />

  return (
    <Button variant={iconOnly ? 'ghost' : 'default'} size={iconOnly ? 'icon' : 'sm'} className={cn(className)} asChild>
      <Link href={signInHref} aria-label={CARE_HOME.signIn} data-site-return-focus="account" onClick={event => {
        if (!gate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        gate.open({ reason: 'create-account', nextPath: new URL(signInHref, window.location.origin).searchParams.get('next') ?? undefined, trigger: event.currentTarget })
      }}>{iconOnly ? <UserRound aria-hidden /> : CARE_HOME.signIn}</Link>
    </Button>
  )
}
