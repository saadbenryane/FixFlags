'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { FileText, MessageSquare } from 'lucide-react'
import { WorkspaceMobileTabs } from '@/components/report/WorkspaceMobileTabs'
import {
  WORKSPACE_PANEL_HEADER_CLASS,
  WORKSPACE_PANE_SCROLL_CLASS,
  WORKSPACE_SPLIT_GRID_CLASS,
} from '@/components/report/workspace-geometry'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface ReportWorkspaceSplitShellProps {
  ariaLabel?: string
  scanning?: boolean
  leftPanel: ReactNode
  reportHeader?: ReactNode
  reportPanel: ReactNode
  /** When provided, used only to delay `data-workspace-ready` until controlled state settles on Report. */
  controlledView?: 'report' | string
  onViewChange?: (view: 'report') => void
  syncViewToUrl?: boolean
  initialMobileFocus?: MobileFocus
  footer?: ReactNode
  className?: string
}

type MobileFocus = 'chat' | 'product'

export const REPORT_PLAYBACK_SCROLL_MT = 'scroll-mt-[var(--report-chrome-offset)]'

/**
 * Default live report shell: Agent beside Report.
 * Preview, Timeline, and Canvas stay parked. Legacy `view=timeline|canvas`
 * query params normalize to `view=report`.
 */
export function ReportWorkspaceSplitShell({
  ariaLabel,
  scanning = false,
  leftPanel,
  reportHeader,
  reportPanel,
  controlledView,
  onViewChange,
  syncViewToUrl = true,
  initialMobileFocus,
  footer,
  className,
}: ReportWorkspaceSplitShellProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const resolvedPathname = pathname || '/'
  const shellId = useId().replace(/:/g, '')
  const agentPanelId = `${shellId}-agent-panel`
  const productPanelId = `${shellId}-product-panel`
  const mobileTabsId = `${shellId}-mobile-tab`
  const requestedView = searchParams?.get('view') ?? null
  const [hydrated, setHydrated] = useState(false)
  const [mobileFocus, setMobileFocus] = useState<MobileFocus>(
    initialMobileFocus ?? (scanning ? 'chat' : 'product')
  )

  useEffect(() => {
    if (!scanning) return
    const saved = window.sessionStorage.getItem(`fixflags:workspace-panel:${resolvedPathname}`)
    if (saved === 'chat' || saved === 'product') setMobileFocus(saved)
    if (saved === 'preview') setMobileFocus('product')
  }, [resolvedPathname, scanning])

  const chooseMobileFocus = (next: MobileFocus) => {
    setMobileFocus(next)
    window.sessionStorage.setItem(`fixflags:workspace-panel:${resolvedPathname}`, next)
  }

  useEffect(() => {
    if (!syncViewToUrl || !requestedView || requestedView === 'report') return
    const url = new URL(window.location.href)
    url.searchParams.set('view', 'report')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    onViewChange?.('report')
  }, [onViewChange, requestedView, syncViewToUrl])

  useEffect(() => {
    let readinessFrame = 0
    const markReadyWhenCanonical = () => {
      const duplicateCanonicalNode =
        document.querySelectorAll('#report-status').length > 1 ||
        document.querySelectorAll('[id$="-agent-panel"]').length > 1 ||
        document.querySelectorAll('[id$="-product-panel"]').length > 1
      if (duplicateCanonicalNode) {
        readinessFrame = window.requestAnimationFrame(markReadyWhenCanonical)
        return
      }
      setHydrated(true)
    }
    readinessFrame = window.requestAnimationFrame(markReadyWhenCanonical)
    return () => {
      window.cancelAnimationFrame(readinessFrame)
    }
  }, [])

  const workspaceReady = hydrated && (
    controlledView === undefined ||
    controlledView === 'report' ||
    !syncViewToUrl
  )

  const mobileTabs = [
    {
      id: `${mobileTabsId}-chat`,
      label: REPORT_COPY.workspace.panels.chatTab,
      selected: mobileFocus === 'chat',
      onSelect: () => chooseMobileFocus('chat'),
      controls: agentPanelId,
      icon: <MessageSquare className="h-3.5 w-3.5" aria-hidden />,
    },
    {
      id: `${mobileTabsId}-report`,
      label: REPORT_COPY.workspace.panels.productTab,
      selected: mobileFocus === 'product',
      onSelect: () => chooseMobileFocus('product'),
      controls: productPanelId,
      icon: <FileText className="h-3.5 w-3.5" aria-hidden />,
    },
  ]

  return (
    <section
      aria-label={ariaLabel}
      data-workspace-ready={workspaceReady ? 'true' : undefined}
      className={cn(
        REPORT_PLAYBACK_SCROLL_MT,
        'flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-clip',
        className
      )}
    >
      <WorkspaceMobileTabs
        label={REPORT_COPY.workspace.panels.mobileTabsLabel}
        tabs={mobileTabs}
      />

      <div className={cn('grid min-h-0 flex-1', WORKSPACE_SPLIT_GRID_CLASS)}>
        <div
          id={agentPanelId}
          role="tabpanel"
          aria-labelledby={`${mobileTabsId}-chat`}
          className={cn(
            'h-full min-h-0 min-w-0 max-w-full',
            mobileFocus === 'chat' ? 'block' : 'hidden',
            'lg:block'
          )}
        >
          {leftPanel}
        </div>
        <div
          id={productPanelId}
          role="tabpanel"
          aria-label={REPORT_COPY.workspace.panels.productReality}
          className={cn(
            'h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden bg-background',
            mobileFocus === 'product' ? 'flex' : 'hidden',
            'lg:flex'
          )}
        >
          {reportHeader ? (
            <div className={cn(WORKSPACE_PANEL_HEADER_CLASS, 'h-auto min-w-0 max-w-full flex-wrap py-2')}>
              <div className="min-w-0 max-w-full flex-1">{reportHeader}</div>
            </div>
          ) : null}
          <div className={cn(WORKSPACE_PANE_SCROLL_CLASS, 'max-w-full overflow-x-auto')}>
            {reportPanel}
          </div>
        </div>
      </div>
      {footer ? (
        <div className="flex shrink-0 items-center justify-end border-t border-border/45 px-3 py-3 sm:px-4">
          {footer}
        </div>
      ) : null}
    </section>
  )
}
