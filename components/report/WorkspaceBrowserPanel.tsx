'use client'

import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { resolveCapturePair } from '@/lib/audit/screenshot-types'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import type { PlaybackStep } from '@/components/report/WorkspacePlaybackStrip'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface WorkspaceBrowserPanelProps {
  url: string
  screenshots?: AuditScreenshot[]
  /** Capture progress for the live view: pending/ok/failed per device. */
  captureStatus?: ScreenshotCaptureStatus | null
  /** When a playback step is selected, the browser shows that step instead of the live captures. */
  activeStep?: PlaybackStep | null
  onCloseStep?: () => void
  className?: string
}

export function WorkspaceBrowserPanel({
  url,
  screenshots = [],
  captureStatus,
  activeStep,
  onCloseStep,
  className,
}: WorkspaceBrowserPanelProps) {
  const { desktop, mobile, desktopState, mobileState } = resolveCapturePair(
    screenshots,
    captureStatus
  )

  if (activeStep) {
    return (
      <div className={cn('flex min-h-[240px] flex-col gap-3', className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {REPORT_COPY.workspace.playback.stepNumber(
              activeStep.eventIndex + 1
            )}{' '}
            · {activeStep.label}
          </p>
          {onCloseStep ? (
            <button
              type="button"
              className="min-h-11 px-2 text-xs font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand hover:text-foreground"
              onClick={onCloseStep}
            >
              {REPORT_COPY.workspace.playback.backToLive}
            </button>
          ) : null}
        </div>
        {activeStep.screenshot ? (
          <BrowserFrame
            label={activeStep.label}
            url={activeStep.url ?? url}
            imageUrl={activeStep.screenshot}
            device="desktop"
            className="flex-1"
          />
        ) : (
          <p className="rounded-card border border-border bg-card/50 p-4 text-sm text-muted-foreground">
            {REPORT_COPY.workspace.playback.noScreenshot}
          </p>
        )}
      </div>
    )
  }

  const bothFailed = desktopState === 'failed' && mobileState === 'failed'

  return (
    <div className={cn('flex min-h-[240px] flex-col gap-3', className)}>
      <BrowserFrame
        label="Desktop"
        url={url}
        imageUrl={desktop}
        state={desktopState}
        device="desktop"
        className="flex-1"
      />
      <BrowserFrame
        label="Mobile"
        url={url}
        imageUrl={mobile}
        state={mobileState}
        device="mobile"
        className="max-w-xs"
      />
      {!desktop && !mobile && bothFailed ? (
        <p className="text-sm text-muted-foreground">
          {REPORT_COPY.workspace.playback.empty(url)}
        </p>
      ) : null}
    </div>
  )
}
