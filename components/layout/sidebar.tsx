'use client'

import { useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Boxes,
  Settings,
  CreditCard,
  Menu,
  ShieldCheck,
  CircleHelp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { AvatarMenu } from '@/components/layout/AvatarMenu'
import { useMe } from '@/hooks/useMe'
import { isNavActive } from '@/lib/site/nav-active'
import { planLabel } from '@/lib/billing/plans'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const PRIMARY_ITEMS: SidebarItem[] = [
  { href: '/dashboard', label: 'Products', icon: Boxes },
]

const SECONDARY_ITEMS: SidebarItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/help', label: 'Help', icon: CircleHelp },
]

const ADMIN_ITEM: SidebarItem = { href: '/admin', label: 'Admin', icon: ShieldCheck }

function SidebarNav({
  onNav,
  showAdmin,
  compact = false,
}: {
  onNav?: () => void
  showAdmin?: boolean
  compact?: boolean
}) {
  const pathname = usePathname()

  function handleClick(href: string) {
    onNav?.()
    if (pathname === href) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const secondaryItems = showAdmin ? [...SECONDARY_ITEMS, ADMIN_ITEM] : SECONDARY_ITEMS

  function renderItem(item: SidebarItem) {
    const active = isNavActive(pathname, item.href)
    const Icon = item.icon
    const link = (
      <Link
        key={item.href}
        href={item.href as Route}
        onClick={() => handleClick(item.href)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-11 items-center rounded-[var(--radius-control)] text-sm font-medium transition-colors duration-150',
          compact ? 'justify-center px-2' : 'gap-3 px-3 py-2',
          active
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <Icon className={cn('shrink-0', compact ? 'h-5 w-5' : 'h-4 w-4')} />
        <span className={cn(compact && 'sr-only')}>{item.label}</span>
      </Link>
    )
    if (!compact) return link
    return (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {PRIMARY_ITEMS.map(renderItem)}
      <Separator className="my-2" />
      {secondaryItems.map(renderItem)}
    </nav>
  )
}

function SidebarFooter({ compact = false }: { compact?: boolean }) {
  const { user } = useMe()

  return (
    <div className={cn('shrink-0 border-t border-border/60 py-3', compact ? 'px-2' : 'px-4')}>
      {user && (
        <div className={cn('flex items-center', compact ? 'justify-center' : 'gap-3')}>
          {compact ? (
            <Tooltip>
              <TooltipTrigger asChild><span><AvatarMenu user={user} /></span></TooltipTrigger>
              <TooltipContent side="right">
                {user.name ?? user.email} · {planLabel(user.plan)}
              </TooltipContent>
            </Tooltip>
          ) : (
            <AvatarMenu user={user} />
          )}
          {!compact && <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {planLabel(user.plan)} plan
            </p>
          </div>}
        </div>
      )}
      <div className={cn('mt-3 flex items-center', compact ? 'flex-col gap-1' : 'justify-between')}>
        {!compact && <SignOutButton />}
        <ThemeToggle />
      </div>
    </div>
  )
}

export function DesktopSidebar({ showAdmin }: { showAdmin?: boolean }) {
  return (
    <TooltipProvider delayDuration={150}>
      <aside className="fixed inset-y-0 z-navbar hidden w-16 flex-col border-r border-border/50 glass-surface-strong md:flex">
        <div className="flex h-[var(--header-height)] shrink-0 items-center justify-center border-b border-border/40">
          <Logo variant="mark" size="sm" href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <SidebarNav showAdmin={showAdmin} compact />
        </div>
        <SidebarFooter compact />
      </aside>
    </TooltipProvider>
  )
}

export function MobileSidebar({ showAdmin }: { showAdmin?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[260px] flex-col p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
      <div className="flex h-[var(--header-height)] items-center px-4 border-b border-border/40 shrink-0">
          <Logo variant="lockup" size="md" href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav showAdmin={showAdmin} onNav={() => setOpen(false)} />
        </div>
        <SidebarFooter />
      </SheetContent>
    </Sheet>
  )
}
