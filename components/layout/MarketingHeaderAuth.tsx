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
  const { user, isLoading } = useMe()

  if (isLoading) return null

  if (!user) {
    if (mode === 'mobileSheet') {
      return (
        <div className="space-y-3">
          <Link
            href="/sign-in"
            onClick={onNavigate}
            className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Button variant="ink" size="sm" className="w-full" asChild>
            <Link href="/sign-up" onClick={onNavigate}>
              {HERO.navSignUpCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )
    }

    return (
      <div
        className={cn(
          'flex items-center gap-3 sm:gap-4',
          mode === 'desktop' && 'ml-3'
        )}
      >
        <Link
          href="/sign-in"
          className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
        >
          Log in
        </Link>
        <span
          className="hidden h-4 w-px bg-border/70 sm:block"
          aria-hidden
        />
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
