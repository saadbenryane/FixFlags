'use client'

import { Skeleton } from '@/components/ui/skeleton'
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
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
}

function viewportAspectStyle(device: Device): { aspectRatio: string } {
  const vp = device === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT
  return { aspectRatio: `${vp.width} / ${vp.height}` }
}

export function BrowserFrame({
  url,
  imageUrl,
  alt = 'Page screenshot',
  state,
  className,
  label,
  device = 'desktop',
}: Props) {
  const preset = SCREENSHOT_FRAME[device]
  const resolvedLabel = label ?? preset.label

  const resolvedState: BrowserFrameState =
    state ?? (imageUrl ? 'loaded' : 'loading')

  const displayUrl = url ? truncateUrl(url, 56) : 'Capturing page...'

  return (
    <div className={cn('w-full rounded-card bg-card shadow-card overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/60">
        <div className="flex gap-1 shrink-0">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="flex-1 min-w-0 rounded-md bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground truncate">
          {displayUrl}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground shrink-0">
          {resolvedLabel}
        </span>
      </div>

      <div
        className="relative w-full overflow-hidden bg-muted/30"
        style={viewportAspectStyle(device)}
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
            className="absolute inset-0 h-full w-full object-cover object-top animate-fade-in"
          />
        )}
      </div>
    </div>
  )
}
