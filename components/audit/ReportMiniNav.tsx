'use client'

import { useEffect, useMemo, useState } from 'react'
import { FilterPill } from '@/components/ui/filter-pill'
import { cn } from '@/lib/utils'

const BASE_SECTIONS = [
  { id: 'report-overview', label: 'Overview' },
  { id: 'report-flags', label: 'Flags' },
  { id: 'report-rubrics', label: 'Rubrics' },
  { id: 'report-recheck', label: 'Re-check' },
] as const

type NavSection = { id: string; label: string }

interface Props {
  className?: string
  showPreviews?: boolean
  showFlow?: boolean
}

export function ReportMiniNav({ className, showPreviews, showFlow }: Props) {
  const sections = useMemo((): NavSection[] => {
    const items: NavSection[] = [...BASE_SECTIONS]
    const overviewIndex = items.findIndex((s) => s.id === 'report-overview')
    const insertAt = overviewIndex >= 0 ? overviewIndex + 1 : 0
    const optional: Array<{ id: string; label: string }> = []
    if (showPreviews) optional.push({ id: 'report-previews', label: 'Previews' })
    if (showFlow) optional.push({ id: 'report-flow', label: 'Flow test' })
    if (optional.length > 0) {
      items.splice(insertAt, 0, ...optional)
    }
    return items
  }, [showPreviews, showFlow])

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

  return (
    <nav
      aria-label="Report sections"
      className={cn(
        'sticky z-10 -mx-1 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-thin',
        'top-[var(--header-offset)]',
        className
      )}
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
  )
}
