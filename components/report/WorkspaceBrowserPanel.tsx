'use client'

import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { resolveCapturePair } from '@/lib/audit/screenshot-types'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import type { PlaybackStep } from '@/lib/audit/playback-steps'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export type PreviewDevice = 'desktop' | 'mobile'

interface WorkspaceBrowserPanelProps {
  url: string
  screenshots?: AuditScreenshot[]
  /** Capture progress for the live view: pending/ok/failed per device. */
  captureStatus?: ScreenshotCaptureStatus | null
  /** When a playback step is selected, the stage shows that step instead of the live capture. */
  activeStep?: PlaybackStep | null
  /** Which viewport the stage presents. The Product header owns the control. */
  device?: PreviewDevice
  className?: string
}

/**
 * The Product stage: one captured page, letterboxed, filling its container.
 * It owns no chrome and no controls, so switching device or step changes only
 * the image inside a stage whose size never moves.
 */
export function WorkspaceBrowserPanel({
  url,
  screenshots = [],
  captureStatus,
  activeStep,
  device = 'desktop',
  className,
}: WorkspaceBrowserPanelProps) {
  const { desktop, mobile, desktopState, mobileState } = resolveCapturePair(
    screenshots,
    captureStatus
  )

  if (activeStep) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
        {activeStep.screenshot ? (
          <BrowserFrame
            label={activeStep.label}
            url={activeStep.url ?? url}
            imageUrl={activeStep.screenshot}
            device="desktop"
            chrome="none"
            fill
            className="min-h-0 flex-1"
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              {REPORT_COPY.workspace.playback.noScreenshot}
            </p>
          </div>
        )}
      </div>
    )
  }

  const activeImage = device === 'mobile' ? mobile : desktop
  const activeState = device === 'mobile' ? mobileState : desktopState
  const bothFailed = desktopState === 'failed' && mobileState === 'failed'

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <BrowserFrame
        label={
          device === 'mobile'
            ? REPORT_COPY.workspace.panels.mobileDevice
            : REPORT_COPY.workspace.panels.desktopDevice
        }
        url={url}
        imageUrl={activeImage}
        state={activeState}
        loadingLabel={REPORT_COPY.workspace.playback.capturing}
        device={device}
        chrome="none"
        fill
        className="min-h-0 flex-1"
      />
      {!desktop && !mobile && bothFailed ? (
        <p className="shrink-0 border-t border-border/40 px-4 py-2 text-sm text-muted-foreground">
          {REPORT_COPY.workspace.playback.empty(url)}
        </p>
      ) : null}
    </div>
  )
}
