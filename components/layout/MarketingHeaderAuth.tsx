'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { useMe } from '@/hooks/useMe'

export function MarketingHeaderAuth() {
  const { user } = useMe()

  if (!user) {
    return (
      <Button variant="default" size="sm" asChild className="ml-2">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
      <SignOutButton />
    </div>
  )
}
