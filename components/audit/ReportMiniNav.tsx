'use client'

import { useEffect, useState } from 'react'
import { FilterPill } from '@/components/ui/filter-pill'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'report-overview', label: 'Overview' },
  { id: 'report-flags', label: 'Flags' },
  { id: 'report-rubrics', label: 'Rubrics' },
  { id: 'report-recheck', label: 'Re-check' },
] as const

export function ReportMiniNav({ className }: { className?: string }) {
  const [active, setActive] = useState<string>(SECTIONS[0].id)

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    for (const section of SECTIONS) {
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
  }, [])

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
      {SECTIONS.map((section) => (
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
