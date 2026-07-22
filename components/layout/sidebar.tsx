'use client'

import { useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Gauge,
  Cpu,
  Settings,
  KeyRound,
  GitBranch,
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

interface SidebarItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const PRIMARY_ITEMS: SidebarItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/dashboard/mcp-analytics', label: 'MCP', icon: Cpu },
]

const SECONDARY_ITEMS: SidebarItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/settings/api-keys', label: 'API Keys', icon: KeyRound },
  { href: '/settings/integrations', label: 'Integrations', icon: GitBranch },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/help', label: 'Help', icon: CircleHelp },
]

const ADMIN_ITEM: SidebarItem = { href: '/admin', label: 'Admin', icon: ShieldCheck }

function SidebarNav({ onNav, showAdmin }: { onNav?: () => void; showAdmin?: boolean }) {
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
    return (
      <Link
        key={item.href}
        href={item.href as Route}
        onClick={() => handleClick(item.href)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
          active
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
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

function SidebarFooter() {
  const { user } = useMe()

  return (
    <div className="shrink-0 border-t border-border/60 px-4 py-3">
      {user && (
        <div className="flex items-center gap-3">
          <AvatarMenu user={user} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {planLabel(user.plan)} plan
            </p>
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <SignOutButton />
        <ThemeToggle />
      </div>
    </div>
  )
}

export function DesktopSidebar({ showAdmin }: { showAdmin?: boolean }) {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:z-navbar border-r border-border/60 glass-surface-strong">
      <div className="flex h-14 items-center px-4 border-b border-border/40 shrink-0">
        <Logo variant="lockup" size="md" href="/dashboard" />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav showAdmin={showAdmin} />
      </div>
      <SidebarFooter />
    </aside>
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
        <div className="flex h-14 items-center px-4 border-b border-border/40 shrink-0">
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
