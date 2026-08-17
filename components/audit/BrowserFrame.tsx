'use client'

import type { CSSProperties, ReactNode, Ref } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  viewportAspectStyle,
  SCREENSHOT_FRAME,
} from '@/lib/audit/viewports'
import { displayHostname } from '@/lib/utils/url-helpers'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import { cn } from '@/lib/utils'

type BrowserFrameState = 'loading' | 'loaded' | 'failed'
type Device = 'desktop' | 'mobile'
type BrowserFrameChrome = 'browser' | 'none'

interface Props {
  url?: string
  imageUrl?: string | null
  alt?: string
  state?: BrowserFrameState
  className?: string
  label?: string
  /** desktop = 1280×900, mobile = 375×812 (matches Playwright capture) */
  device?: Device
  /**
   * `browser` draws the illustrative browser bar for marketing and compare
   * surfaces. `none` renders only the captured page, for the review editor
   * where the Product pane header already carries identity and URL.
   */
  chrome?: BrowserFrameChrome
  /**
   * Fill the parent's height instead of deriving height from the device
   * aspect ratio. The capture letterboxes inside a stage that never resizes
   * when the viewer switches device.
   */
  fill?: boolean
  /** Told to the viewer while the capture is still pending, over the skeleton. */
  loadingLabel?: string
  /** Rendered inside the image viewport (0–1 coords relative to capture) */
  viewportOverlay?: ReactNode
  /** Ref on the screenshot viewport container (for height-matched mobile layout) */
  viewportRef?: Ref<HTMLDivElement>
  /** Fixed viewport dimensions (overrides aspect-ratio sizing) */
  viewportSize?: { height: number; width: number }
}

export function BrowserFrame({
  url,
  imageUrl,
  alt = 'Page screenshot',
  state,
  className,
  label,
  device = 'desktop',
  chrome = 'browser',
  fill = false,
  loadingLabel,
  viewportOverlay,
  viewportRef,
  viewportSize,
}: Props) {
  const preset = SCREENSHOT_FRAME[device]
  const resolvedLabel = label ?? preset.label

  const resolvedState: BrowserFrameState =
    state ?? (imageUrl ? 'loaded' : 'loading')
  const resolvedImageUrl = imageUrl ? normalizeInternalScreenshotUrl(imageUrl) : null

  const displayUrl = url ? displayHostname(url) : 'Capturing page...'

  // In fill mode the parent owns the height, so no intrinsic sizing is applied.
  const resolvedViewportStyle: CSSProperties | undefined = fill
    ? undefined
    : viewportSize
      ? { height: viewportSize.height, width: viewportSize.width }
      : viewportAspectStyle(device)

  return (
    <div
      className={cn(
        'overflow-hidden',
        chrome === 'browser' && 'rounded-md bg-card shadow-card',
        fill
          ? 'flex h-full min-h-0 w-full flex-col'
          : viewportSize
            ? 'w-auto max-w-full shrink-0'
            : 'w-full',
        className
      )}
    >
      {chrome === 'browser' ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-muted/50 px-3 py-2">
          <div className="flex shrink-0 gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
          </div>
          <div className="min-w-0 flex-1 truncate rounded-md bg-background/80 px-2.5 py-1 text-2xs text-muted-foreground">
            {displayUrl}
          </div>
          <span className="meta-label shrink-0 text-muted-foreground">
            {resolvedLabel}
          </span>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={cn(
          'relative overflow-hidden bg-muted/30',
          fill && 'min-h-0 flex-1'
        )}
        style={resolvedViewportStyle}
      >
        {resolvedState === 'loading' && (
          <>
            <Skeleton className="absolute inset-0 rounded-none" />
            {loadingLabel ? (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                {loadingLabel}
              </p>
            ) : null}
          </>
        )}

        {resolvedState === 'failed' && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
            <p className="text-sm text-muted-foreground">
              Screenshot could not be captured for this check.
            </p>
          </div>
        )}

        {resolvedState === 'loaded' && resolvedImageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={resolvedImageUrl}
            alt={alt}
            width={1440}
            height={900}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain object-center motion-safe:animate-capture-fade"
          />
        )}

        {resolvedState === 'loaded' && resolvedImageUrl && viewportOverlay && (
          <div className="pointer-events-none absolute inset-0">
            <div className="pointer-events-auto relative h-full w-full">{viewportOverlay}</div>
          </div>
        )}
      </div>
    </div>
  )
}
