'use client'

import { useRef, useState } from 'react'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { APP_NAV_COPY } from '@/lib/marketing/copy/navigation'
import { MCP_IS_DISCOVERABLE } from '@/lib/mcp/discoverability'
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
  KeyRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { AvatarMenu } from '@/components/layout/AvatarMenu'
import { useMe } from '@/hooks/useMe'
import { isNavActive } from '@/lib/site/nav-active'
import { planLabel } from '@/lib/billing/plans'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}
type SidebarGate = (href: string, trigger: HTMLElement) => boolean

const PRIMARY_ITEMS: SidebarItem[] = [
  { href: '/dashboard', label: SITE_WORKSPACE_COPY.websites, icon: Boxes },
]

const SECONDARY_ITEMS: SidebarItem[] = [
  { href: '/billing', label: APP_NAV_COPY.billing, icon: CreditCard },
  ...(MCP_IS_DISCOVERABLE ? [{ href: '/settings/api-keys' as const, label: APP_NAV_COPY.apiKeys, icon: KeyRound }] : []),
  { href: '/docs', label: APP_NAV_COPY.docs, icon: BookOpen },
  { href: '/help', label: APP_NAV_COPY.help, icon: CircleHelp },
]

const ADMIN_ITEM: SidebarItem = { href: '/admin', label: APP_NAV_COPY.admin, icon: ShieldCheck }
const SETTINGS_ITEM: SidebarItem = { href: '/settings', label: APP_NAV_COPY.account, icon: Settings }

export function SidebarNav({
  onNav,
  showAdmin,
  compact = false,
  primaryOnly = false,
  onGatedItem,
}: {
  onNav?: () => void
  showAdmin?: boolean
  compact?: boolean
  /** The app panel keeps only the websites here; account destinations live in the account menu. */
  primaryOnly?: boolean
  onGatedItem?: SidebarGate
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
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          if (onGatedItem?.(item.href, event.currentTarget)) {
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
      {primaryOnly ? null : <div className="mt-3 flex flex-col gap-1">{secondaryItems.map(renderItem)}</div>}
    </nav>
  )
}

export function SidebarFooter({ compact = false }: { compact?: boolean }) {
  const { user } = useMe()

  return (
    <div className={cn('shrink-0 py-3', compact ? 'px-2' : 'px-4')}>
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

type MobileSidebarProps = { showAdmin?: boolean; variant?: 'account' | 'report'; onGatedItem?: SidebarGate }

export function MobileSidebar(props: MobileSidebarProps) {
  const pathname = usePathname()
  return <MobileSidebarMenu key={pathname} {...props} />
}

function MobileSidebarMenu({ showAdmin, variant = 'account', onGatedItem }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button ref={trigger} variant="ghost" size="icon" className={variant === 'report' ? 'md:hidden' : undefined} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[260px] flex-col p-0" aria-describedby={undefined} onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null
        // Next links prevent the browser default after accepting navigation.
        // A cancelled Settings navigation stops propagation before this owner.
        if (link instanceof HTMLAnchorElement && (!link.target || link.target === '_self') && !link.hasAttribute('download')) setOpen(false)
      }}>
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex h-[var(--header-height)] shrink-0 items-center px-4">
          <Logo variant="lockup" size="md" href={variant === 'report' ? '/' : '/dashboard'} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav showAdmin={showAdmin} onGatedItem={onGatedItem ? (href, link) => onGatedItem(href, trigger.current ?? link) : undefined} />
        </div>
        {variant === 'account' ? <SidebarFooter /> : null}
      </SheetContent>
    </Sheet>
  )
}
