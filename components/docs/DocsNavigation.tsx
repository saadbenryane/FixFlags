'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOCS_GROUPS, DOCS_PAGES } from '@/lib/docs/catalog'
import { cn } from '@/lib/utils'
import { BookOpen, ChartNoAxesCombined, Flag, LifeBuoy, Plug, Search, ShoppingBag, Terminal, WandSparkles, Waypoints } from 'lucide-react'
import s from './DocsExperience.module.css'

const PAGE_ICONS = { home: BookOpen, 'getting-started': Waypoints, 'site-care': Flag, 'fix-with-ai': WandSparkles, mcp: Terminal, integrations: Plug, shopify: ShoppingBag, 'google-analytics': ChartNoAxesCombined, 'google-search-console': Search, troubleshooting: LifeBuoy }

export function DocsNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Documentation" className={s.navigation}>
      {DOCS_GROUPS.map((group) => (
        <section key={group}>
          <h2 className={s.groupTitle}>
            {group}
          </h2>
          <ul className="space-y-0.5">
            {DOCS_PAGES.filter((page) => page.group === group).map((page) => {
              const active = pathname === page.path
              const Icon = PAGE_ICONS[page.key]
              return (
                <li key={page.path}>
                  <Link
                    href={page.path as Route}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(s.navLink, active && s.active)}
                  >
                    <Icon aria-hidden size={17} strokeWidth={1.5} />{page.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
