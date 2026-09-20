'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { CARE_HOME } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

function signInHref(nextPath: string): Route {
  return `/sign-in?next=${encodeURIComponent(nextPath)}` as Route
}

export function SiteChromeAuth({
  className,
}: {
  className?: string
}) {
  const { user } = useMe()
  const pathname = usePathname()
  if (user) return null

  return (
    <Button variant="brand" size="sm" className={cn(className)} asChild>
      <Link href={signInHref(pathname || '/')}>{CARE_HOME.signIn}</Link>
    </Button>
  )
}
