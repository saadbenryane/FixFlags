'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Container } from '@/components/ui/container'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'

const BASE_SECTIONS = [
  { id: 'report-flags', label: 'Flags' },
  { id: 'report-rubrics', label: 'Rubrics' },
  { id: 'report-monitoring', label: REPORT_COPY.recheck.label },
] as const

type NavSection = { id: string; label: string }

interface Props {
  className?: string
  showOverview?: boolean
  showPreviews?: boolean
  showFlow?: boolean
  showFix?: boolean
  showLaunchGates?: boolean
  siteUrl?: string
  score?: number | null
}

export function ReportMiniNav({
  className,
  showOverview,
  showPreviews,
  showFlow,
  showFix,
  showLaunchGates,
  siteUrl,
  score,
}: Props) {
  const navShellRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)
  const sections = useMemo((): NavSection[] => {
    const items: NavSection[] = [...BASE_SECTIONS]
    const insertAt = 1
    const optional: Array<{ id: string; label: string }> = []
    if (showOverview) optional.push({ id: 'report-overview', label: 'Overview' })
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
  }, [showOverview, showPreviews, showFlow, showFix, showLaunchGates])

  const [active, setActive] = useState<string>(sections[0]?.id ?? BASE_SECTIONS[0].id)

  useEffect(() => {
    let frame = 0

    const updateStuck = () => {
      frame = 0
      const el = navShellRef.current
      if (!el) return
      setIsStuck(el.getBoundingClientRect().top <= 57)
    }

    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateStuck)
    }

    updateStuck()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

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
  const scoreColor = score != null ? scoreToScanColor(score) : 'hsl(var(--muted-foreground))'

  return (
    <div
      ref={navShellRef}
      className={cn(
        'sticky top-14 z-navbar border-y border-border/35 bg-background/82 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70',
        isStuck && 'shadow-glass'
      )}
    >
      <Container className="flex items-center gap-5 overflow-x-auto scrollbar-thin">
        {hostname && isStuck && (
          <span className="flex max-w-[170px] shrink-0 items-center gap-2 truncate text-xs font-medium text-muted-foreground">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: scoreColor }}
              aria-hidden
            />
            <span className="truncate">{hostname}</span>
          </span>
        )}
        <nav
          aria-label="Report sections"
          className={cn('flex min-w-max items-center gap-5', className)}
        >
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              onClick={() => scrollTo(section.id)}
              aria-current={active === section.id ? 'page' : undefined}
              className={cn(
                'relative h-12 shrink-0 border-b-2 px-0.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
                active === section.id
                  ? 'border-brand text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </Container>
    </div>
  )
}
