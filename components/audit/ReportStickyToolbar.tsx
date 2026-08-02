'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Container } from '@/components/ui/container'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import { scrollToReportSection } from '@/lib/report/scroll-to-section'
import { cn } from '@/lib/utils'
import { displayHostname } from '@/lib/utils/url-helpers'

const TOP_FIXES_SECTION = { id: 'report-top-fixes', label: REPORT_COPY.stickyNav.topFixes } as const
const FLAGS_SECTION = { id: 'report-flags', label: REPORT_COPY.stickyNav.flags } as const
const STACK_SECTION = { id: 'report-stack', label: REPORT_COPY.stickyNav.stack } as const
const CONTRACT_SECTION = { id: 'report-contract', label: REPORT_COPY.stickyNav.contract } as const
const REMEMBER_SECTION = { id: 'report-remember', label: REPORT_COPY.stickyNav.remember } as const
const FUNNEL_SECTION = { id: 'report-funnel', label: REPORT_COPY.stickyNav.journey } as const
const PREVIEWS_SECTION = { id: 'report-previews', label: REPORT_COPY.stickyNav.previews } as const
const LAUNCH_SECTION = { id: 'report-launch-gates', label: REPORT_COPY.stickyNav.launch } as const
const RECHECK_SECTION = { id: 'report-recheck', label: REPORT_COPY.recheck.label } as const

type NavSection = { id: string; label: string }

interface Props {
  className?: string
  showPolish?: boolean
  showContract?: boolean
  showRemember?: boolean
  showJourney?: boolean
  showFlow?: boolean
  showTimeline?: boolean
  showPreviews?: boolean
  showLaunch?: boolean
  showStack?: boolean
  showRecheckSection?: boolean
  siteUrl?: string
  actions?: ReactNode
  auditId?: string
}

function readHeaderHeightPx(): number {
  if (typeof window === 'undefined') return 56
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) return 56
  if (raw.endsWith('rem')) return parsed * 16
  return parsed
}

export function ReportStickyToolbar({
  className,
  showPolish = false,
  showContract = false,
  showRemember = false,
  showJourney = false,
  showFlow = false,
  showTimeline = false,
  showPreviews = false,
  showLaunch = false,
  showStack = false,
  showRecheckSection = true,
  siteUrl,
  actions,
  auditId,
}: Props) {
  const navShellRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [isStuck, setIsStuck] = useState(false)
  const sections = useMemo((): NavSection[] => {
    const items: NavSection[] = []
    if (showPolish) items.push(TOP_FIXES_SECTION)
    items.push(FLAGS_SECTION)
    if (showStack) items.push(STACK_SECTION)
    if (showContract) items.push(CONTRACT_SECTION)
    if (showRemember) items.push(REMEMBER_SECTION)
    if (showJourney || showFlow || showTimeline) items.push(FUNNEL_SECTION)
    if (showPreviews) items.push(PREVIEWS_SECTION)
    if (showLaunch) items.push(LAUNCH_SECTION)
    if (showRecheckSection) items.push(RECHECK_SECTION)
    return items
  }, [
    showPolish,
    showContract,
    showRemember,
    showJourney,
    showFlow,
    showTimeline,
    showPreviews,
    showLaunch,
    showStack,
    showRecheckSection,
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

    const ratios = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.intersectionRatio)
        }
        let bestId = sections[0]?.id ?? FLAGS_SECTION.id
        let bestRatio = 0
        for (const section of sections) {
          const ratio = ratios.get(section.id) ?? 0
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = section.id
          }
        }
        if (bestRatio > 0) setActive(bestId)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    )

    for (const section of sections) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [sections])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const activeButton = nav.querySelector<HTMLButtonElement>(`[data-section-id="${active}"]`)
    if (!activeButton || typeof activeButton.scrollIntoView !== 'function') return
    try {
      activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    } catch {
      /* scrollIntoView is not fully implemented in some test runtimes */
    }
  }, [active])

  function scrollTo(id: string) {
    scrollToReportSection(id)
    setActive(id)
    trackEvent('sticky_nav_used', {
      section_id: id,
      audit_id: auditId,
      surface: 'focused',
    })
  }

  const hostname = siteUrl ? displayHostname(siteUrl) : null

  if (sections.length < 2) return null

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
            <span className="hidden max-w-[140px] shrink-0 items-center truncate text-xs font-medium text-muted-foreground sm:flex">
              <span className="truncate">{hostname}</span>
            </span>
          )}
          <nav
            ref={navRef}
            aria-label="Report sections"
            className={cn('flex min-w-max items-center gap-3 sm:gap-5', className)}
          >
            {sections.map((section) => (
              <button
                type="button"
                key={section.id}
                data-section-id={section.id}
                onClick={() => scrollTo(section.id)}
                aria-current={active === section.id ? 'page' : undefined}
                className={cn(
                  'relative shrink-0 border-b-2 px-0.5 font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
                  'min-h-11 text-xs sm:text-sm',
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
