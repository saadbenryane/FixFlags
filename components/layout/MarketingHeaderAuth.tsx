'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { HERO } from '@/lib/marketing/copy'
import { AvatarMenu } from '@/components/layout/AvatarMenu'
import { cn } from '@/lib/utils'

export function MarketingHeaderAuth({
  mode = 'desktop',
  onNavigate,
}: {
  mode?: 'desktop' | 'mobileTop' | 'mobileSheet'
  onNavigate?: () => void
}) {
  const { user } = useMe()

  // While the session fetch is in flight, user is null and we render the
  // logged-out state. Most marketing visitors are logged out, so this avoids a
  // late CTA pop-in; a signed-in visitor sees a brief swap to their avatar.
  if (!user) {
    // Sheet: Log in only. Try free stays in the mobile top bar so the
    // accessibility tree does not expose two signup CTAs when the menu opens.
    if (mode === 'mobileSheet') {
      return (
        <Link
          href="/sign-in"
          onClick={onNavigate}
          className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Log in
        </Link>
      )
    }

    // mobileTop: signup CTA only (Log in lives in the sheet on small screens).
    if (mode === 'mobileTop') {
      return (
        <Button variant="ink" size="sm" asChild>
          <Link href="/sign-up">
            {HERO.navSignUpCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      )
    }

    return (
      <div className={cn('flex items-center gap-3 sm:gap-4', 'ml-3')}>
        <Link
          href="/sign-in"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Log in
        </Link>
        <span className="h-4 w-px bg-border/70" aria-hidden />
        <Button variant="ink" size="sm" asChild>
          <Link href="/sign-up">
            {HERO.navSignUpCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    )
  }

  if (mode === 'mobileSheet') {
    return (
      <Button variant="outline" size="sm" className="w-full justify-center" asChild>
        <Link href="/dashboard" onClick={onNavigate}>
          Dashboard
        </Link>
      </Button>
    )
  }

  return (
    <div className={cn('flex items-center', mode === 'desktop' && 'ml-2')}>
      <AvatarMenu user={user} />
    </div>
  )
}
