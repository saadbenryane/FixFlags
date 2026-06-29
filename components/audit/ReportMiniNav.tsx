'use client'

import { useEffect, useMemo, useState } from 'react'
import { FilterPill } from '@/components/ui/filter-pill'
import { Container } from '@/components/ui/container'
import { cn } from '@/lib/utils'

const BASE_SECTIONS = [
  { id: 'report-flags', label: 'Flags' },
  { id: 'report-overview', label: 'Overview' },
  { id: 'report-rubrics', label: 'Rubrics' },
  { id: 'report-recheck', label: 'Re-check' },
] as const

type NavSection = { id: string; label: string }

interface Props {
  className?: string
  showPreviews?: boolean
  showFlow?: boolean
  showFix?: boolean
  showLaunchGates?: boolean
  siteUrl?: string
}

export function ReportMiniNav({
  className,
  showPreviews,
  showFlow,
  showFix,
  showLaunchGates,
  siteUrl,
}: Props) {
  const sections = useMemo((): NavSection[] => {
    const items: NavSection[] = [...BASE_SECTIONS]
    const overviewIndex = items.findIndex((s) => s.id === 'report-overview')
    const insertAt = overviewIndex >= 0 ? overviewIndex + 1 : 1
    const optional: Array<{ id: string; label: string }> = []
    if (showPreviews) optional.push({ id: 'report-previews', label: 'Previews' })
    if (showFlow) optional.push({ id: 'report-flow', label: 'Flow test' })
    if (showLaunchGates) optional.push({ id: 'report-launch-gates', label: 'Launch' })
    if (optional.length > 0) {
      items.splice(insertAt, 0, ...optional)
    }
    if (showFix) {
      const flagsIndex = items.findIndex((s) => s.id === 'report-flags')
      items.splice(flagsIndex + 1, 0, { id: 'report-fix', label: 'Fix prompt' })
    }
    return items
  }, [showPreviews, showFlow, showFix, showLaunchGates])

  const [active, setActive] = useState<string>(sections[0]?.id ?? BASE_SECTIONS[0].id)

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    for (const section of sections) {
      const el = document.getElementById(section.id)
      if (!el) continue

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActive(section.id)
            }
          }
        },
        { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
      )
      observer.observe(el)
      observers.push(observer)
    }

    return () => observers.forEach((o) => o.disconnect())
  }, [sections])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActive(id)
    }
  }

  const hostname = (() => {
    if (!siteUrl) return null
    try {
      return new URL(siteUrl).hostname
    } catch {
      return null
    }
  })()

  return (
    <div className="sticky top-14 z-navbar border-0 glass-nav">
      <Container className="flex items-center gap-4 overflow-x-auto scrollbar-thin">
        {hostname && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground truncate max-w-[160px]">
            {hostname}
          </span>
        )}
        <nav
          aria-label="Report sections"
          className={cn('flex items-center gap-2 py-2', className)}
        >
          {sections.map((section) => (
            <FilterPill
              key={section.id}
              active={active === section.id}
              onClick={() => scrollTo(section.id)}
            >
              {section.label}
            </FilterPill>
          ))}
        </nav>
      </Container>
    </div>
  )
}
