'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Boxes, CircleHelp, LogOut, Settings } from 'lucide-react'
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
import { authClient } from '@/lib/auth-client'
import { planLabel } from '@/lib/billing/plans'
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
  side = 'bottom',
  align = 'end',
}: {
  className?: string
  user?: MeUser | null
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) {
  const router = useRouter()
  const { user: fetchedUser } = useMe()
  const user = providedUser ?? fetchedUser

  if (!user) return null

  async function handleSignOut() {
    await authClient.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex rounded-full transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
            className
          )}
          aria-label="Account menu"
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
            Products
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
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
          onSelect={() => {
            void handleSignOut()
          }}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
