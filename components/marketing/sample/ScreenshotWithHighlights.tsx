'use client'

import { useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import {
  DESKTOP_FRAME_FLEX_CLASS,
  MOBILE_FRAME_WIDTH_CLASS,
  MOBILE_VIEWPORT,
  SCREENSHOT_FRAMES_ROW_CLASS,
} from '@/lib/audit/viewports'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { EvidenceHighlight } from '@/lib/marketing/sample-report-display'
import { cn } from '@/lib/utils'

interface ScreenshotWithHighlightsProps {
  url: string
  host: string
  desktopScreenshot: string | null
  mobileScreenshot: string | null
  preferredDevice: 'desktop' | 'mobile'
  highlights: EvidenceHighlight[]
  severity?: string
  className?: string
}

function pinColorClass(severity?: string): string {
  if (severity === 'CRITICAL') return 'bg-destructive ring-destructive/25'
  if (severity === 'IMPORTANT') return 'bg-brand ring-brand/25'
  return 'bg-muted-foreground ring-muted-foreground/20'
}

function PinOverlay({ highlight, severity }: { highlight: EvidenceHighlight; severity?: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="absolute z-[1]"
      style={{
        left: `${highlight.x * 100}%`,
        top: `${highlight.y * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <button
        type="button"
        className={cn(
          'h-3 w-3 rounded-full shadow-md ring-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          pinColorClass(severity),
          hovered && 'scale-125'
        )}
        aria-label={`Evidence: ${highlight.label}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      />
      {hovered && (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-10 max-w-[14rem] rounded-md border border-border/60 bg-card px-3 py-2 text-left shadow-raised',
            highlight.y > 0.55 ? 'bottom-full mb-2' : 'top-full mt-2',
            highlight.x > 0.5 ? 'right-0' : 'left-0'
          )}
        >
          <p className="text-[11px] font-semibold text-foreground">{highlight.label}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground text-pretty">
            {highlight.detail}
          </p>
        </div>
      )}
    </div>
  )
}

function HighlightLayer({
  highlights,
  device,
  severity,
}: {
  highlights: EvidenceHighlight[]
  device: 'desktop' | 'mobile'
  severity?: string
}) {
  const visible = highlights.filter((h) => h.device === device)
  if (visible.length === 0) return null

  return (
    <>
      {visible.map((h) => (
        <PinOverlay key={h.id} highlight={h} severity={severity} />
      ))}
    </>
  )
}

function FramedScreenshot({
  url,
  imageUrl,
  device,
  host,
  highlights,
  severity,
}: {
  url: string
  imageUrl: string | null
  device: 'desktop' | 'mobile'
  host: string
  highlights: EvidenceHighlight[]
  severity?: string
}) {
  return (
    <BrowserFrame
      url={url}
      imageUrl={imageUrl}
      device={device}
      alt={`${device} screenshot of ${host}`}
      viewportOverlay={
        imageUrl ? <HighlightLayer highlights={highlights} device={device} severity={severity} /> : undefined
      }
    />
  )
}

export function ScreenshotWithHighlights({
  url,
  host,
  desktopScreenshot,
  mobileScreenshot,
  preferredDevice,
  highlights,
  severity,
  className,
}: ScreenshotWithHighlightsProps) {
  const defaultTab =
    preferredDevice === 'mobile' && mobileScreenshot ? 'mobile' : 'desktop'
  const hasDesktop = Boolean(desktopScreenshot)
  const hasMobile = Boolean(mobileScreenshot)

  if (!hasDesktop && !hasMobile) return null

  if (!hasDesktop && hasMobile) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className={cn('mx-auto', MOBILE_FRAME_WIDTH_CLASS)}>
          <FramedScreenshot
            url={url}
            imageUrl={mobileScreenshot}
            device="mobile"
            host={host}
            highlights={highlights}
            severity={severity}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="w-full sm:hidden">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-md bg-muted/50 p-1">
            <TabsTrigger value="desktop" className="gap-1.5 rounded-sm py-2 text-xs">
              <Monitor className="h-3.5 w-3.5" aria-hidden />
              Desktop
            </TabsTrigger>
            <TabsTrigger value="mobile" className="gap-1.5 rounded-sm py-2 text-xs">
              <Smartphone className="h-3.5 w-3.5" aria-hidden />
              Mobile
            </TabsTrigger>
          </TabsList>
          <TabsContent value="desktop" className="mt-3">
            <FramedScreenshot
              url={url}
              imageUrl={desktopScreenshot}
              device="desktop"
              host={host}
              highlights={highlights}
              severity={severity}
            />
          </TabsContent>
          <TabsContent value="mobile" className="mt-3">
            <div className={cn('mx-auto', MOBILE_FRAME_WIDTH_CLASS)}>
              <FramedScreenshot
                url={url}
                imageUrl={mobileScreenshot}
                device="mobile"
                host={host}
                highlights={highlights}
                severity={severity}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className={cn('hidden sm:flex', SCREENSHOT_FRAMES_ROW_CLASS)}>
        <div className={DESKTOP_FRAME_FLEX_CLASS}>
          <FramedScreenshot
            url={url}
            imageUrl={desktopScreenshot}
            device="desktop"
            host={host}
            highlights={highlights}
            severity={severity}
          />
        </div>
        {hasMobile && (
          <div
            className={MOBILE_FRAME_WIDTH_CLASS}
            title={`${MOBILE_VIEWPORT.width}×${MOBILE_VIEWPORT.height} viewport`}
          >
            <FramedScreenshot
              url={url}
              imageUrl={mobileScreenshot}
              device="mobile"
              host={host}
              highlights={highlights}
              severity={severity}
            />
          </div>
        )}
      </div>

      {highlights.length > 0 && (
        <p className="text-center text-[10px] text-muted-foreground/70">
          Hover pins for evidence
        </p>
      )}
    </div>
  )
}
