'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { useMe } from '@/hooks/useMe'
import { HERO } from '@/lib/marketing/copy'

export function MarketingHeaderAuth() {
  const { user } = useMe()

  if (!user) {
    return (
      <div className="ml-2 flex items-center gap-2 sm:gap-3">
        <Link
          href="/sign-in"
          className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
        >
          Log in
        </Link>
        <Button variant="ink" size="sm" asChild>
          <Link href="/#audit">
            {HERO.primaryCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="ml-2 flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
      <SignOutButton />
    </div>
  )
}
