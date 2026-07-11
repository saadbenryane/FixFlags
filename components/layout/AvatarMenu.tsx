'use client'

import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { useMe, type MeUser } from '@/hooks/useMe'
import { cn } from '@/lib/utils'

function getInitials(name: string | null | undefined, email: string): string {
  const trimmedName = name?.trim()
  if (trimmedName) {
    const initials = trimmedName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')

    if (initials) return initials.toUpperCase()
  }

  return email[0]?.toUpperCase() ?? '?'
}

export function AvatarMenu({
  className,
  user: providedUser,
}: {
  className?: string
  user?: MeUser | null
}) {
  const { user: fetchedUser } = useMe()
  const user = providedUser ?? fetchedUser

  if (!user) return null

  return (
    <Link
      href="/dashboard"
      className={cn(
        'inline-flex rounded-full transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className
      )}
      aria-label="Open dashboard"
      title="Dashboard"
    >
      <Avatar
        fallback={getInitials(user.name, user.email)}
        size="md"
        className="border border-border/60 bg-foreground text-background shadow-sm transition-[background-color,box-shadow] duration-150 ease-out hover:shadow-md"
      />
    </Link>
  )
}
