'use client'

import Link from 'next/link'
import { Boxes, CircleHelp, LoaderCircle, LogOut, Settings } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMe, type MeUser } from '@/hooks/useMe'
import { planLabel } from '@/lib/billing/plans'
import { cn } from '@/lib/utils'
import { SITE_SETTINGS_COPY } from '@/lib/marketing/copy/site-settings'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { useSignOut } from '@/hooks/useSignOut'
import { AUTH } from '@/lib/marketing/copy/auth'

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
  side = 'bottom',
  align = 'end',
}: {
  className?: string
  user?: MeUser | null
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) {
  const { busy, signOut } = useSignOut()
  const { user: fetchedUser } = useMe()
  const user = providedUser ?? fetchedUser

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
            className
          )}
          aria-label="Account menu"
          data-site-return-focus="account"
        >
          <Avatar
            fallback={getInitials(user.name, user.email)}
            size="md"
            className="border border-border/60 bg-foreground text-background shadow-sm transition-[background-color,box-shadow] duration-150 ease-out hover:shadow-md"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">
            {user.name ?? user.email}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {planLabel(user.plan)} plan
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="gap-2">
            <Boxes className="h-4 w-4" />
            {SITE_WORKSPACE_COPY.websites}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="gap-2">
            <Settings className="h-4 w-4" />
            {SITE_SETTINGS_COPY.accountSettings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help" className="gap-2">
            <CircleHelp className="h-4 w-4" />
            Help
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          disabled={busy}
          aria-busy={busy || undefined}
          onSelect={(event) => {
            event.preventDefault()
            void signOut()
          }}
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden />
          )}
          {busy ? AUTH.signOut.working : AUTH.signOut.menuCta}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
