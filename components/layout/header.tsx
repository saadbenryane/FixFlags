'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ADMIN_NAV, MARKETING_NAV } from '@/lib/site/nav'
import {
  NAV_LINK_ACTIVE,
  NAV_LINK_BASE,
  NAV_LINK_INACTIVE,
  NAV_LINK_MOBILE_ACTIVE,
  NAV_LINK_MOBILE_BASE,
} from '@/lib/site/nav-styles'
import { NavLink } from '@/components/layout/nav-link'
import { Logo } from '@/components/brand/Logo'
import { Container } from '@/components/ui/container'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { MarketingHeaderAuth } from '@/components/layout/MarketingHeaderAuth'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export type HeaderVariant = 'marketing' | 'app' | 'admin'

interface HeaderProps {
  variant?: HeaderVariant
  logoHref?: string
  right?: React.ReactNode
  className?: string
  adminInboxUnread?: number
}

export function Header({
  variant = 'marketing',
  logoHref,
  right,
  className,
  adminInboxUnread = 0,
}: HeaderProps) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const navLinks = variant === 'admin' ? ADMIN_NAV : MARKETING_NAV

  const defaultLogoHref = variant === 'admin' ? '/dashboard' : '/'

  const defaultRight = variant === 'admin' ? <AdminHeaderRight /> : null

  const resolvedRight = right ?? defaultRight
  const isMarketing = variant === 'marketing'

  useEffect(() => {
    if (!isMarketing) return

    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isMarketing])

  return (
    <header
      className={cn(
        'sticky top-0 z-navbar border-0 transition-[background-color,box-shadow,backdrop-filter] duration-200 ease-out',
        isMarketing && !scrolled && 'bg-transparent shadow-none backdrop-blur-none',
        (!isMarketing || scrolled) && 'glass-nav',
        className
      )}
    >
      <Container>
        <div
          className={cn(
            'grid h-14 items-center gap-3',
            isMarketing ? 'grid-cols-[auto_1fr_auto] md:grid-cols-[1fr_auto_1fr]' : 'grid-cols-[auto_1fr_auto]'
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Logo
              variant="lockup"
              size="md"
              href={logoHref ?? defaultLogoHref}
            />
            {variant === 'admin' && (
              <span className="hidden rounded-md bg-destructive/10 px-2 py-0.5 text-3xs font-semibold uppercase tracking-label text-destructive sm:inline">
                Admin
              </span>
            )}
          </div>

          <nav
            className={cn(
              'items-center gap-0.5',
              isMarketing ? 'hidden justify-center md:flex' : 'hidden md:flex'
            )}
          >
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                className={NAV_LINK_BASE}
                activeClassName={NAV_LINK_ACTIVE}
                inactiveClassName={NAV_LINK_INACTIVE}
              >
                <span className="inline-flex items-center gap-1.5">
                  {link.label}
                  {variant === 'admin' && link.href === '/admin/feedback' && adminInboxUnread > 0 && (
                    <Badge variant="destructive" size="sm" className="h-4 min-w-4 px-1">
                      {adminInboxUnread > 9 ? '9+' : adminInboxUnread}
                    </Badge>
                  )}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-1">
            <div className="hidden items-center gap-0.5 md:flex">
              {resolvedRight}
            </div>

            <div className="flex items-center gap-1 md:hidden">
              {isMarketing && (
                <MarketingHeaderAuth mode="mobileTop" />
              )}
              <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>
                    <Logo variant="wordmark" size="sm" />
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <NavLink
                      key={link.href}
                      href={link.href}
                      onNavigate={() => setOpen(false)}
                      className={NAV_LINK_MOBILE_BASE}
                      activeClassName={NAV_LINK_MOBILE_ACTIVE}
                      inactiveClassName={NAV_LINK_INACTIVE}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {link.label}
                        {variant === 'admin' && link.href === '/admin/feedback' && adminInboxUnread > 0 && (
                          <Badge variant="destructive" size="sm" className="h-4 min-w-4 px-1">
                            {adminInboxUnread > 9 ? '9+' : adminInboxUnread}
                          </Badge>
                        )}
                      </span>
                    </NavLink>
                  ))}
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Theme</span>
                      <ThemeToggle />
                    </div>
                    {isMarketing && (
                      <MarketingHeaderAuth
                        mode="mobileSheet"
                        onNavigate={() => setOpen(false)}
                      />
                    )}
                    {!isMarketing && <div>{resolvedRight}</div>}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
            </div>
          </div>
        </div>
      </Container>
    </header>
  )
}

function AdminHeaderRight() {
  return (
    <div className="ml-2 flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
      <SignOutButton />
    </div>
  )
}
