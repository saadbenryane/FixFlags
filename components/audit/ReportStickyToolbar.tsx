'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Container } from '@/components/ui/container'
import { ScoreDot } from '@/components/ui/score-dot'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'
import { displayHostname } from '@/lib/utils/url-helpers'

const CONTRACT_SECTION = { id: 'report-contract', label: REPORT_COPY.stickyNav.contract } as const
const REMEMBER_SECTION = { id: 'report-remember', label: REPORT_COPY.stickyNav.remember } as const
const JOURNEY_SECTION = { id: 'report-journey', label: REPORT_COPY.stickyNav.journey } as const
const FLOW_SECTION = { id: 'report-flow', label: REPORT_COPY.stickyNav.flow } as const
const TIMELINE_SECTION = { id: 'report-timeline', label: REPORT_COPY.stickyNav.timeline } as const
const FLAGS_SECTION = { id: 'report-flags', label: REPORT_COPY.stickyNav.flags } as const
const STACK_SECTION = { id: 'report-stack', label: REPORT_COPY.stickyNav.stack } as const
const PREVIEWS_SECTION = { id: 'report-previews', label: REPORT_COPY.stickyNav.previews } as const
const LAUNCH_SECTION = { id: 'report-launch-gates', label: REPORT_COPY.stickyNav.launch } as const
const RECHECK_SECTION = { id: 'report-monitoring', label: REPORT_COPY.recheck.label } as const
const RECHECK_RESULTS_SECTION = { id: 'recheck-results', label: REPORT_COPY.recheck.label } as const

type NavSection = { id: string; label: string }

interface Props {
  className?: string
  showContract?: boolean
  showRemember?: boolean
  showJourney?: boolean
  showFlow?: boolean
  showTimeline?: boolean
  showPreviews?: boolean
  showLaunch?: boolean
  showStack?: boolean
  showRecheckSection?: boolean
  /** When true, Re-check nav scrolls to the diff strip instead of the bottom hint. */
  hasRecheckDiff?: boolean
  siteUrl?: string
  score?: number | null
  actions?: ReactNode
}

function readHeaderHeightPx(): number {
  if (typeof window === 'undefined') return 56
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) return 56
  // rem → px when unit is rem
  if (raw.endsWith('rem')) return parsed * 16
  return parsed
}

export function ReportStickyToolbar({
  className,
  showContract = false,
  showRemember = false,
  showJourney = false,
  showFlow = false,
  showTimeline = false,
  showPreviews = false,
  showLaunch = false,
  showStack = false,
  showRecheckSection = true,
  hasRecheckDiff = false,
  siteUrl,
  score,
  actions,
}: Props) {
  const navShellRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)
  const sections = useMemo((): NavSection[] => {
    const items: NavSection[] = []
    if (showContract) items.push(CONTRACT_SECTION)
    if (showRemember) items.push(REMEMBER_SECTION)
    if (showJourney) items.push(JOURNEY_SECTION)
    if (showFlow) items.push(FLOW_SECTION)
    if (showTimeline) items.push(TIMELINE_SECTION)
    if (showStack) items.push(STACK_SECTION)
    items.push(FLAGS_SECTION)
    if (showPreviews) items.push(PREVIEWS_SECTION)
    if (showLaunch) items.push(LAUNCH_SECTION)
    if (showRecheckSection) {
      items.push(hasRecheckDiff ? RECHECK_RESULTS_SECTION : RECHECK_SECTION)
    }
    return items
  }, [
    showContract,
    showRemember,
    showJourney,
    showFlow,
    showTimeline,
    showPreviews,
    showLaunch,
    showStack,
    showRecheckSection,
    hasRecheckDiff,
  ])

  const [active, setActive] = useState<string>(sections[0]?.id ?? FLAGS_SECTION.id)

  useEffect(() => {
    let frame = 0

    const updateStuck = () => {
      frame = 0
      const el = navShellRef.current
      if (!el) return
      const headerPx = readHeaderHeightPx()
      setIsStuck(el.getBoundingClientRect().top <= headerPx + 1)
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
    if (typeof IntersectionObserver === 'undefined') return

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

  return (
    <div
      ref={navShellRef}
      className={cn(
        'sticky top-[var(--header-height)] z-navbar w-full border-y border-border/35 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80',
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
              <ScoreDot score={score ?? null} size="sm" />
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
