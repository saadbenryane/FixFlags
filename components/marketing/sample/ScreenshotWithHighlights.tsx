'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from 'react'
import {
  mobileViewportSizeForHeight,
  viewportAspectStyle,
} from '@/lib/audit/viewports'
import type { EvidenceHighlight } from '@/lib/marketing/sample-report-display'
import { cn } from '@/lib/utils'

interface ScreenshotWithHighlightsProps {
  host: string
  desktopScreenshot: string | null
  mobileScreenshot: string | null
  highlights: EvidenceHighlight[]
  selectedFlagId?: string
  onPinSelect?: (flagId: string) => void
  showDesktop?: boolean
  showMobile?: boolean
  className?: string
}

function EvidenceRegionGlow({
  highlight,
  selected,
}: {
  highlight: EvidenceHighlight
  selected?: boolean
}) {
  const isCritical = highlight.severity === 'CRITICAL'
  const isPage = highlight.scope === 'page'

  return (
    <div
      className={cn(
        'pointer-events-none absolute rounded-md transition-opacity duration-300',
        selected ? 'opacity-100' : 'opacity-0',
        isPage && 'ring-inset',
        isCritical
          ? cn(
              'ring-2 ring-destructive',
              !isPage &&
                'shadow-[0_0_0_1px_hsl(var(--destructive)/0.35),0_0_24px_4px_hsl(var(--destructive)/0.35)] motion-safe:animate-pulse motion-reduce:animate-none'
            )
          : cn(
              'ring-2 ring-brand',
              !isPage &&
                'shadow-[0_0_0_1px_hsl(var(--brand)/0.3),0_0_24px_4px_hsl(var(--peach-glow)/0.4)] motion-safe:animate-pulse motion-reduce:animate-none'
            )
      )}
      style={{
        left: `${highlight.x * 100}%`,
        top: `${highlight.y * 100}%`,
        width: `${highlight.width * 100}%`,
        height: `${highlight.height * 100}%`,
      }}
      aria-hidden={!selected}
    >
      {selected && !isPage && (
        <span
          className={cn(
            'absolute left-0 max-w-[min(100%,14rem)] -translate-y-full -top-1 px-2 py-1 text-[10px] font-semibold leading-tight text-pretty',
            isCritical ? 'text-destructive' : 'text-brand'
          )}
        >
          {highlight.visualTarget}
        </span>
      )}
    </div>
  )
}

function RegionLayer({
  highlights,
  device,
  selectedFlagId,
}: {
  highlights: EvidenceHighlight[]
  device: 'desktop' | 'mobile'
  selectedFlagId?: string
}) {
  const visible = highlights.filter((h) => h.device === device && h.flagId === selectedFlagId)
  if (visible.length === 0) return null

  return (
    <>
      {visible.map((h) => (
        <EvidenceRegionGlow key={h.id} highlight={h} selected />
      ))}
    </>
  )
}

function ScreenshotPanel({
  imageUrl,
  device,
  host,
  highlights,
  selectedFlagId,
  className,
  containerRef,
  size,
}: {
  imageUrl: string
  device: 'desktop' | 'mobile'
  host: string
  highlights: EvidenceHighlight[]
  selectedFlagId?: string
  className?: string
  containerRef?: Ref<HTMLDivElement>
  size?: { width: number; height: number }
}) {
  const panelStyle: CSSProperties = size
    ? { width: size.width, height: size.height, maxHeight: size.height, flexShrink: 0 }
    : viewportAspectStyle(device)

  const active = highlights.some((h) => h.device === device && h.flagId === selectedFlagId)

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded-md bg-muted/30 shadow-card',
        size ? 'shrink-0' : 'w-full',
        className
      )}
      style={panelStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`${device} screenshot of ${host}`}
        className={cn(
          'absolute inset-0 h-full w-full object-cover object-top transition-[filter] duration-300',
          active && 'brightness-[0.92]'
        )}
      />
      <div className="pointer-events-none absolute inset-0">
        <RegionLayer highlights={highlights} device={device} selectedFlagId={selectedFlagId} />
      </div>
    </div>
  )
}

export function ScreenshotWithHighlights({
  host,
  desktopScreenshot,
  mobileScreenshot,
  highlights,
  selectedFlagId,
  showDesktop = true,
  showMobile = true,
  className,
}: ScreenshotWithHighlightsProps) {
  const showDesktopPanel = showDesktop && Boolean(desktopScreenshot)
  const showMobilePanel = showMobile && Boolean(mobileScreenshot)

  const desktopPanelRef = useRef<HTMLDivElement>(null)
  const [desktopPanelHeight, setDesktopPanelHeight] = useState<number | null>(null)

  const measureDesktopPanel = useCallback(() => {
    const el = desktopPanelRef.current
    if (!el) return
    const height = el.getBoundingClientRect().height
    if (height > 0) {
      setDesktopPanelHeight(height)
    }
  }, [])

  const sideBySide = showDesktopPanel && showMobilePanel

  useLayoutEffect(() => {
    if (!sideBySide) return
    measureDesktopPanel()
    const el = desktopPanelRef.current
    if (!el) return
    const ro = new ResizeObserver(measureDesktopPanel)
    ro.observe(el)
    return () => ro.disconnect()
  }, [sideBySide, desktopScreenshot, measureDesktopPanel])

  useEffect(() => {
    if (!sideBySide || !desktopScreenshot) return
    const img = desktopPanelRef.current?.querySelector('img')
    if (!img) return
    const onLoad = () => measureDesktopPanel()
    img.addEventListener('load', onLoad)
    if (img.complete) onLoad()
    return () => img.removeEventListener('load', onLoad)
  }, [sideBySide, desktopScreenshot, measureDesktopPanel])

  const mobilePanelSize =
    desktopPanelHeight != null ? mobileViewportSizeForHeight(desktopPanelHeight) : null

  if (!showDesktopPanel && !showMobilePanel) return null

  if (showDesktopPanel && !showMobilePanel) {
    return (
      <div className={cn('w-full', className)}>
        <ScreenshotPanel
          imageUrl={desktopScreenshot!}
          device="desktop"
          host={host}
          highlights={highlights}
          selectedFlagId={selectedFlagId}
        />
      </div>
    )
  }

  if (!showDesktopPanel && showMobilePanel) {
    return (
      <div className={cn('w-full', className)}>
        <ScreenshotPanel
          imageUrl={mobileScreenshot!}
          device="mobile"
          host={host}
          highlights={highlights}
          selectedFlagId={selectedFlagId}
        />
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex w-full min-w-0 items-start gap-3 sm:gap-6">
        <div className="min-w-0 flex-1">
          <ScreenshotPanel
            imageUrl={desktopScreenshot!}
            device="desktop"
            host={host}
            highlights={highlights}
            selectedFlagId={selectedFlagId}
            containerRef={desktopPanelRef}
          />
        </div>
        {mobilePanelSize && (
          <ScreenshotPanel
            imageUrl={mobileScreenshot!}
            device="mobile"
            host={host}
            highlights={highlights}
            selectedFlagId={selectedFlagId}
            size={mobilePanelSize}
          />
        )}
      </div>
    </div>
  )
}
