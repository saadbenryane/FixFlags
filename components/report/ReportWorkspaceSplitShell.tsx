'use client'

import { useState, type ReactNode } from 'react'
import { WorkspaceViewToggle, type WorkspacePanelView } from '@/components/report/WorkspaceViewToggle'
import { cn } from '@/lib/utils'

interface ReportWorkspaceSplitShellProps {
  isActiveReview?: boolean
  leftPanel: ReactNode
  browserPanel: ReactNode
  reportPanel: ReactNode
  playbackPanel?: ReactNode | null
  mobileProductPanel?: ReactNode
  className?: string
}

type MobileFocus = 'chat' | 'product'

export function ReportWorkspaceSplitShell({
  isActiveReview = false,
  leftPanel,
  browserPanel,
  reportPanel,
  playbackPanel,
  mobileProductPanel,
  className,
}: ReportWorkspaceSplitShellProps) {
  const [view, setView] = useState<WorkspacePanelView>(isActiveReview ? 'browser' : 'report')
  const [mobileFocus, setMobileFocus] = useState<MobileFocus>('product')

  const productContent = view === 'browser' ? browserPanel : reportPanel

  return (
    <div className={cn('space-y-3', className)}>
      <div className="hidden items-center justify-between gap-3 lg:flex">
        <WorkspaceViewToggle view={view} onChange={setView} />
      </div>

      <div className="flex gap-2 lg:hidden">
        <button
          type="button"
          className={cn(
            'flex-1 rounded-md border px-3 py-2 text-sm font-medium',
            mobileFocus === 'chat' ? 'border-brand bg-brand/10' : 'border-border'
          )}
          onClick={() => setMobileFocus('chat')}
        >
          Chat
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 rounded-md border px-3 py-2 text-sm font-medium',
            mobileFocus === 'product' ? 'border-brand bg-brand/10' : 'border-border'
          )}
          onClick={() => setMobileFocus('product')}
        >
          Product
        </button>
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="space-y-3">{leftPanel}</div>
        <div className="space-y-3">
          {productContent}
          {playbackPanel}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {mobileFocus === 'chat' ? leftPanel : mobileProductPanel ?? productContent}
        {playbackPanel}
      </div>
    </div>
  )
}
