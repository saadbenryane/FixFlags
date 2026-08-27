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
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
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
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/docs', label: 'Docs', icon: BookOpen },
  { href: '/help', label: 'Help', icon: CircleHelp },
]

const ADMIN_ITEM: SidebarItem = { href: '/admin', label: 'Admin', icon: ShieldCheck }
const SETTINGS_ITEM: SidebarItem = { href: '/settings', label: 'Settings', icon: Settings }

export function SidebarNav({
  onNav,
  showAdmin,
  compact = false,
  onGatedItem,
}: {
  onNav?: () => void
  showAdmin?: boolean
  compact?: boolean
  onGatedItem?: (href: string) => boolean
}) {
  const pathname = usePathname()

  function handleClick(href: string) {
    onNav?.()
    if (pathname === href) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const secondaryItems = [
    ...SECONDARY_ITEMS,
    ...(showAdmin ? [ADMIN_ITEM] : []),
    SETTINGS_ITEM,
  ]

  function renderItem(item: SidebarItem) {
    const active = isNavActive(pathname, item.href)
    const Icon = item.icon
    const link = (
      <Link
        key={item.href}
        href={item.href as Route}
        onClick={(event) => {
          if (onGatedItem?.(item.href)) {
            event.preventDefault()
            return
          }
          handleClick(item.href)
        }}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex min-h-11 items-center rounded-[var(--radius-control)] text-sm font-medium transition-colors duration-150',
          compact ? 'justify-center px-2' : 'gap-3 px-3 py-2',
          active
            ? cn(
                'bg-brand-muted text-foreground',
                compact &&
                  'after:absolute after:-left-2 after:h-6 after:w-0.5 after:rounded-full after:bg-brand',
              )
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
      <div className={cn('flex', compact ? 'flex-col items-center gap-1' : 'flex-col gap-3')}>
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <ThemeToggle />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Theme</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        )}
        {user &&
          (compact ? (
            <AvatarMenu user={user} side="right" align="end" />
          ) : (
            <div className="flex items-center gap-3">
              <AvatarMenu user={user} side="top" align="start" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {planLabel(user.plan)} plan
                </p>
              </div>
            </div>
          ))}
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
        <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-border/40 px-4">
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
