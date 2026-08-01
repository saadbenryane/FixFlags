'use client'

import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { cn } from '@/lib/utils'

interface WorkspaceBrowserPanelProps {
  url: string
  screenshots?: AuditScreenshot[]
  className?: string
}

export function WorkspaceBrowserPanel({ url, screenshots = [], className }: WorkspaceBrowserPanelProps) {
  const desktop = screenshots.find((s) => s.device === 'DESKTOP')
  const mobile = screenshots.find((s) => s.device === 'MOBILE')

  return (
    <div className={cn('flex min-h-[240px] flex-col gap-3', className)}>
      {desktop ? (
        <BrowserFrame
          label="Desktop"
          url={url}
          imageUrl={desktop.url}
          device="desktop"
          className="flex-1"
        />
      ) : null}
      {mobile ? (
        <BrowserFrame
          label="Mobile"
          url={url}
          imageUrl={mobile.url}
          device="mobile"
          className="max-w-xs"
        />
      ) : null}
      {!desktop && !mobile ? (
        <p className="text-sm text-muted-foreground">
          Browser evidence appears here as FixFlags captures {url}.
        </p>
      ) : null}
    </div>
  )
}
