'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { ADMIN_NAV, APP_NAV, MARKETING_NAV, SECONDARY_MARKETING_NAV } from '@/lib/site/nav'
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
import { HERO } from '@/lib/marketing/copy'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type HeaderVariant = 'marketing' | 'app' | 'admin'

interface HeaderProps {
  variant?: HeaderVariant
  logoHref?: string
  right?: React.ReactNode
  className?: string
  userEmail?: string | null
  showAdmin?: boolean
}

export function Header({
  variant = 'marketing',
  logoHref,
  right,
  className,
  userEmail,
  showAdmin,
}: HeaderProps) {
  const [open, setOpen] = useState(false)

  const navLinks =
    variant === 'app' ? APP_NAV : variant === 'admin' ? ADMIN_NAV : MARKETING_NAV

  const secondaryNavLinks = variant === 'app' ? SECONDARY_MARKETING_NAV : []

  const defaultLogoHref =
    variant === 'app' || variant === 'admin' ? '/dashboard' : '/'

  const defaultRight =
    variant === 'app' ? (
      <AppHeaderRight userEmail={userEmail} showAdmin={showAdmin} />
    ) : variant === 'admin' ? (
      <AdminHeaderRight />
    ) : null

  const resolvedRight = right ?? defaultRight
  const isMarketing = variant === 'marketing'

  return (
    <header className={cn('sticky top-0 z-navbar border-b border-border bg-background/95 backdrop-blur-md', className)}>
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
              <span className="hidden rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-destructive sm:inline">
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
                {link.label}
              </NavLink>
            ))}
            {!isMarketing &&
              secondaryNavLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  className={cn(NAV_LINK_BASE, 'text-xs')}
                  activeClassName={NAV_LINK_ACTIVE}
                  inactiveClassName={NAV_LINK_INACTIVE}
                >
                  {link.label}
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center justify-end gap-1">
            <div className="hidden items-center gap-0.5 md:flex">
              {!isMarketing &&
                secondaryNavLinks.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    className={cn(NAV_LINK_BASE, 'text-xs')}
                    activeClassName={NAV_LINK_ACTIVE}
                    inactiveClassName={NAV_LINK_INACTIVE}
                  >
                    {link.label}
                  </NavLink>
                ))}
              <ThemeToggle />
              {resolvedRight}
            </div>

            <div className="flex items-center gap-1 md:hidden">
              {isMarketing && (
                <Button variant="ink" size="sm" className="h-8 shrink-0 px-3 text-xs" asChild>
                  <Link href="/#audit">{HERO.primaryCta}</Link>
                </Button>
              )}
              <ThemeToggle />
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
                      {link.label}
                    </NavLink>
                  ))}
                  {secondaryNavLinks.map((link) => (
                    <NavLink
                      key={link.href}
                      href={link.href}
                      onNavigate={() => setOpen(false)}
                      className={NAV_LINK_MOBILE_BASE}
                      activeClassName={NAV_LINK_MOBILE_ACTIVE}
                      inactiveClassName={NAV_LINK_INACTIVE}
                    >
                      {link.label}
                    </NavLink>
                  ))}
                  <div className="mt-4 border-t pt-4">
                    <Link
                      href="/sign-in"
                      onClick={() => setOpen(false)}
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      Log in
                    </Link>
                    {!isMarketing && <div className="mt-3">{resolvedRight}</div>}
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

function AppHeaderRight({
  userEmail,
  showAdmin,
}: {
  userEmail?: string | null
  showAdmin?: boolean
}) {
  return (
    <div className="ml-2 flex items-center gap-2">
      {showAdmin && (
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">Admin</Link>
        </Button>
      )}
      {userEmail && (
        <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground lg:inline">
          {userEmail}
        </span>
      )}
      <SignOutButton />
    </div>
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
