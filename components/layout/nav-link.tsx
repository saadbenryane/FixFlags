'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isNavActive } from '@/lib/site/nav-active'
import { cn } from '@/lib/utils'

interface NavLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  activeClassName?: string
  inactiveClassName?: string
  onNavigate?: () => void
}

export function NavLink({
  href,
  children,
  className,
  activeClassName,
  inactiveClassName,
  onNavigate,
}: NavLinkProps) {
  const pathname = usePathname()
  const active = isNavActive(pathname, href)

  function handleClick() {
    onNavigate?.()
    if (active) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <Link
      href={href as Route}
      aria-current={active ? 'page' : undefined}
      onClick={handleClick}
      className={cn(className, active ? activeClassName : inactiveClassName)}
    >
      {children}
    </Link>
  )
}
