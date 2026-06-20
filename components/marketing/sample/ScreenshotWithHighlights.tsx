'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from 'react'
import { createPortal } from 'react-dom'
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

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return narrow
}

function EvidencePin({ severity, active, selected }: { severity?: string; active?: boolean; selected?: boolean }) {
  const isCritical = severity === 'CRITICAL'

  return (
    <span
      className={cn(
        'pointer-events-none relative flex items-center justify-center',
        selected ? 'h-5 w-5' : 'h-4 w-4'
      )}
    >
      <span
        className={cn(
          'absolute inset-0 rounded-full motion-safe:animate-pulse motion-reduce:animate-none',
          isCritical
            ? 'bg-destructive/30 shadow-[0_0_0_4px_hsl(var(--destructive)/0.25),0_0_16px_hsl(var(--destructive)/0.45)]'
            : 'bg-brand/30 shadow-[0_0_0_4px_hsl(var(--brand)/0.25),0_0_16px_hsl(var(--peach-glow)/0.5)]',
          selected && 'opacity-100'
        )}
        aria-hidden
      />
      <span
        className={cn(
          'relative rounded-full bg-white ring-2 transition-transform',
          selected ? 'h-4 w-4 scale-110 ring-brand' : 'h-3.5 w-3.5',
          isCritical ? 'ring-destructive/60' : 'ring-brand/70',
          active && 'scale-110'
        )}
      />
    </span>
  )
}

function PinTooltipContent({
  highlight,
  className,
}: {
  highlight: EvidenceHighlight
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold text-foreground">{highlight.label}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground text-pretty">
        {highlight.detail}
      </p>
    </div>
  )
}

function PinOverlay({
  highlight,
  selected,
  onPinSelect,
  useMobileTooltip,
}: {
  highlight: EvidenceHighlight
  selected?: boolean
  onPinSelect?: (flagId: string) => void
  useMobileTooltip?: boolean
}) {
  const [open, setOpen] = useState(false)
  const narrow = useNarrowViewport()
  const showFixedTooltip = useMobileTooltip && narrow && open
  const pinRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open || showFixedTooltip) return
    const onPointerDown = (e: PointerEvent) => {
      if (pinRef.current?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, showFixedTooltip, close])

  const handleClick = () => {
    onPinSelect?.(highlight.flagId)
    setOpen((prev) => !prev)
  }

  return (
    <>
      <div
        className="absolute z-[1]"
        style={{
          left: `${highlight.x * 100}%`,
          top: `${highlight.y * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <button
          ref={pinRef}
          type="button"
          className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label={`Evidence: ${highlight.label}`}
          aria-expanded={open}
          aria-current={selected ? 'true' : undefined}
          onMouseEnter={() => !narrow && setOpen(true)}
          onMouseLeave={() => !narrow && setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => !narrow && setOpen(false)}
          onClick={handleClick}
        >
          <EvidencePin severity={highlight.severity} active={open} selected={selected} />
        </button>
        {open && !showFixedTooltip && (
          <div
            role="tooltip"
            className={cn(
              'pointer-events-none absolute z-10 max-w-[14rem] rounded-md border border-border/60 bg-card px-3 py-2 text-left shadow-raised',
              highlight.y > 0.55 ? 'bottom-full mb-2' : 'top-full mt-2',
              highlight.x > 0.5 ? 'right-0' : 'left-0'
            )}
          >
            <PinTooltipContent highlight={highlight} />
          </div>
        )}
      </div>

      {showFixedTooltip &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[60] bg-foreground/20"
              aria-label="Close evidence"
              onClick={close}
            />
            <div
              role="tooltip"
              className="fixed left-1/2 top-1/2 z-[61] w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border/60 bg-card px-4 py-3 text-left shadow-raised"
            >
              <PinTooltipContent highlight={highlight} />
            </div>
          </>,
          document.body
        )}
    </>
  )
}

function HighlightLayer({
  highlights,
  device,
  selectedFlagId,
  onPinSelect,
  useMobileTooltip,
  interactiveOnly = false,
}: {
  highlights: EvidenceHighlight[]
  device: 'desktop' | 'mobile'
  selectedFlagId?: string
  onPinSelect?: (flagId: string) => void
  useMobileTooltip?: boolean
  /** When true, only render pins for the selected flag (reduces duplicate a11y nodes). */
  interactiveOnly?: boolean
}) {
  const visible = highlights.filter((h) => {
    if (h.device !== device) return false
    if (interactiveOnly && selectedFlagId && h.flagId !== selectedFlagId) return false
    return true
  })
  if (visible.length === 0) return null

  return (
    <>
      {visible.map((h) => (
        <PinOverlay
          key={h.id}
          highlight={h}
          selected={h.flagId === selectedFlagId}
          onPinSelect={onPinSelect}
          useMobileTooltip={useMobileTooltip}
        />
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
  onPinSelect,
  className,
  useMobileTooltip,
  containerRef,
  size,
  interactiveOnly = false,
}: {
  imageUrl: string
  device: 'desktop' | 'mobile'
  host: string
  highlights: EvidenceHighlight[]
  selectedFlagId?: string
  onPinSelect?: (flagId: string) => void
  className?: string
  useMobileTooltip?: boolean
  containerRef?: Ref<HTMLDivElement>
  size?: { width: number; height: number }
  interactiveOnly?: boolean
}) {
  const panelStyle: CSSProperties = size
    ? { width: size.width, height: size.height, maxHeight: size.height, flexShrink: 0 }
    : viewportAspectStyle(device)

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
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto relative h-full w-full">
          <HighlightLayer
            highlights={highlights}
            device={device}
            selectedFlagId={selectedFlagId}
            onPinSelect={onPinSelect}
            useMobileTooltip={useMobileTooltip}
            interactiveOnly={interactiveOnly}
          />
        </div>
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
  onPinSelect,
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
          onPinSelect={onPinSelect}
          useMobileTooltip
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
          onPinSelect={onPinSelect}
          useMobileTooltip
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
            onPinSelect={onPinSelect}
            containerRef={desktopPanelRef}
            useMobileTooltip
            interactiveOnly
          />
        </div>
        {mobilePanelSize && (
          <ScreenshotPanel
            imageUrl={mobileScreenshot!}
            device="mobile"
            host={host}
            highlights={highlights}
            selectedFlagId={selectedFlagId}
            onPinSelect={onPinSelect}
            size={mobilePanelSize}
            useMobileTooltip
            interactiveOnly
          />
        )}
      </div>
    </div>
  )
}
