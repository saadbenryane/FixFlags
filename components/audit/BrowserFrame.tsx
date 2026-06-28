'use client'

import type { CSSProperties, ReactNode, Ref } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  viewportAspectStyle,
  SCREENSHOT_FRAME,
} from '@/lib/audit/viewports'
import { truncateUrl } from '@/lib/audit/progress-ui'
import { cn } from '@/lib/utils'

type BrowserFrameState = 'loading' | 'loaded' | 'failed'
type Device = 'desktop' | 'mobile'

interface Props {
  url?: string
  imageUrl?: string | null
  alt?: string
  state?: BrowserFrameState
  className?: string
  label?: string
  /** desktop = 1280×900, mobile = 375×812 (matches Puppeteer capture) */
  device?: Device
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
  viewportOverlay,
  viewportRef,
  viewportSize,
}: Props) {
  const preset = SCREENSHOT_FRAME[device]
  const resolvedLabel = label ?? preset.label

  const resolvedState: BrowserFrameState =
    state ?? (imageUrl ? 'loaded' : 'loading')

  const displayUrl = url ? truncateUrl(url, 56) : 'Capturing page...'

  const resolvedViewportStyle: CSSProperties = viewportSize
    ? { height: viewportSize.height, width: viewportSize.width }
    : viewportAspectStyle(device)

  return (
    <div
      className={cn(
        'rounded-md bg-card shadow-card overflow-hidden',
        viewportSize ? 'w-auto max-w-full shrink-0' : 'w-full',
        className
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/60">
        <div className="flex gap-1 shrink-0">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="flex-1 min-w-0 rounded-md bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground truncate">
          {displayUrl}
        </div>
        <span className="meta-label text-muted-foreground shrink-0">
          {resolvedLabel}
        </span>
      </div>

      <div
        ref={viewportRef}
        className="relative overflow-hidden bg-muted/30"
        style={resolvedViewportStyle}
      >
        {resolvedState === 'loading' && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}

        {resolvedState === 'failed' && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
            <p className="text-sm text-muted-foreground">
              Screenshot could not be captured for this audit.
            </p>
          </div>
        )}

        {resolvedState === 'loaded' && imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={alt}
            className="absolute inset-0 h-full w-full object-contain object-top animate-fade-in"
          />
        )}

        {resolvedState === 'loaded' && imageUrl && viewportOverlay && (
          <div className="pointer-events-none absolute inset-0">
            <div className="pointer-events-auto relative h-full w-full">{viewportOverlay}</div>
          </div>
        )}
      </div>
    </div>
  )
}
