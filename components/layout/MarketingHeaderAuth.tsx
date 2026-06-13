'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/auth/SignOutButton'

interface MeUser {
  email?: string | null
  plan?: string
}

export function MarketingHeaderAuth() {
  const [user, setUser] = useState<MeUser | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
  }, [])

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
