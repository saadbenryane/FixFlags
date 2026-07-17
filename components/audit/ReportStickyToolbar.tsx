'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Container } from '@/components/ui/container'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'
import { displayHostname } from '@/lib/utils/url-helpers'

const BASE_SECTIONS = [
  { id: 'report-flags', label: 'Flags' },
  { id: 'report-rubrics', label: 'Rubrics' },
] as const
const RECHECK_SECTION = { id: 'report-monitoring', label: REPORT_COPY.recheck.label } as const
const RECHECK_RESULTS_SECTION = { id: 'recheck-results', label: REPORT_COPY.recheck.label } as const

type NavSection = { id: string; label: string }

interface Props {
  className?: string
  showOverview?: boolean
  showPreviews?: boolean
  showFlow?: boolean
  showLaunchGates?: boolean
  showJourney?: boolean
  showRecheckSection?: boolean
  /** When true, Re-check nav scrolls to the diff strip instead of the bottom hint. */
  hasRecheckDiff?: boolean
  siteUrl?: string
  score?: number | null
  actions?: ReactNode
}

export function ReportStickyToolbar({
  className,
  showOverview,
  showPreviews,
  showFlow,
  showLaunchGates,
  showJourney,
  showRecheckSection = true,
  hasRecheckDiff = false,
  siteUrl,
  score,
  actions,
}: Props) {
  const navShellRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)
  const sections = useMemo((): NavSection[] => {
    const items: NavSection[] = [...BASE_SECTIONS]
    const insertAt = 1
    const optional: Array<{ id: string; label: string }> = []
    if (showJourney) optional.push({ id: 'report-journey', label: 'Journey' })
    if (showOverview) optional.push({ id: 'report-overview', label: 'Overview' })
    if (showPreviews) optional.push({ id: 'report-previews', label: 'Previews' })
    if (showFlow) optional.push({ id: 'report-flow', label: 'Flow test' })
    if (showLaunchGates) optional.push({ id: 'report-launch-gates', label: 'Launch' })
    if (optional.length > 0) {
      items.splice(insertAt, 0, ...optional)
    }
    if (showRecheckSection) {
      items.push(hasRecheckDiff ? RECHECK_RESULTS_SECTION : RECHECK_SECTION)
    }
    return items
  }, [
    showOverview,
    showPreviews,
    showFlow,
    showLaunchGates,
    showJourney,
    showRecheckSection,
    hasRecheckDiff,
  ])

  const [active, setActive] = useState<string>(sections[0]?.id ?? BASE_SECTIONS[0].id)

  useEffect(() => {
    let frame = 0

    const updateStuck = () => {
      frame = 0
      const el = navShellRef.current
      if (!el) return
      setIsStuck(el.getBoundingClientRect().top <= 1)
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

  const hostname = siteUrl ? displayHostname(siteUrl) : null
  const scoreColor = score != null ? scoreToScanColor(score) : 'hsl(var(--muted-foreground))'

  return (
    <div
      ref={navShellRef}
      className={cn(
        'sticky top-0 z-navbar w-full border-y border-border/35 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:top-0',
        isStuck && 'shadow-glass'
      )}
    >
      <Container
        variant="report"
        className="flex flex-col items-stretch gap-0 px-0 py-0 xl:flex-row xl:items-center xl:gap-4"
      >
        <div className="order-2 flex w-full min-w-0 items-center gap-3 overflow-x-auto scrollbar-thin max-xl:gap-2 sm:gap-4 xl:order-1 xl:w-auto xl:flex-1 xl:gap-4">
          {hostname && isStuck && (
            <span className="hidden max-w-[140px] shrink-0 items-center gap-2 truncate text-xs font-medium text-muted-foreground sm:flex">
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
            className={cn('flex min-w-max items-center gap-3 sm:gap-5', className)}
          >
            {sections.map((section) => (
              <button
                type="button"
                key={section.id}
                onClick={() => scrollTo(section.id)}
                aria-current={active === section.id ? 'page' : undefined}
                className={cn(
                  'relative shrink-0 border-b-2 px-0.5 font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
                  'h-10 text-xs max-xl:h-10 sm:h-12 sm:text-sm',
                  active === section.id
                    ? 'border-brand text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
        {actions ? (
          <div className="order-1 flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5 py-1.5 max-xl:gap-1.5 sm:gap-2 sm:py-2 xl:order-2 xl:w-auto xl:shrink-0">
            {actions}
          </div>
        ) : null}
      </Container>
    </div>
  )
}
