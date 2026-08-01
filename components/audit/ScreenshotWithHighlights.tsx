'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import {
  mobileViewportSizeForHeight,
  viewportAspectStyle,
} from '@/lib/audit/viewports'
import type { EvidenceHighlight } from '@/lib/audit/evidence-highlights'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import {
  computeLetterboxLayout,
  highlightCenter,
  mapHighlightToLetterbox,
  normalizedPercent,
  type LetterboxLayout,
} from '@/lib/audit/highlight-geometry'
import { cn } from '@/lib/utils'
import { REPORT_COPY } from '@/lib/marketing/copy'

interface ScreenshotWithHighlightsProps {
  host: string
  desktopScreenshot: string | null
  mobileScreenshot: string | null
  highlights: EvidenceHighlight[]
  selectedFlagId?: string
  onPinSelect?: (flagId: string) => void
  showDesktop?: boolean
  showMobile?: boolean
  affectedDevices?: ('desktop' | 'mobile')[]
  className?: string
}

const MOBILE_ONLY_PREVIEW_HEIGHT = 250

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

function EvidencePin({
  severity,
  active,
  selected,
}: {
  severity?: string
  active?: boolean
  selected?: boolean
}) {
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
          'relative rounded-full bg-background ring-2 transition-transform',
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
      <p className="text-2xs font-semibold text-foreground">{highlight.label}</p>
      <p className="mt-1 text-2xs leading-relaxed text-muted-foreground text-pretty">
        {highlight.detail}
      </p>
    </div>
  )
}

function EvidenceTooltip({
  highlight,
  open,
  showFixedTooltip,
  onClose,
  anchorClassName,
}: {
  highlight: EvidenceHighlight
  open: boolean
  showFixedTooltip: boolean
  onClose: () => void
  anchorClassName: string
}) {
  if (!open) return null

  if (showFixedTooltip) {
    return createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-overlay bg-foreground/20"
          aria-label="Close evidence"
          onClick={onClose}
        />
        <div
          role="tooltip"
          className="fixed left-1/2 top-1/2 z-overlay w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border/60 bg-card px-4 py-3 text-left shadow-raised"
        >
          <PinTooltipContent highlight={highlight} />
        </div>
      </>,
      document.body
    )
  }

  return (
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none absolute z-content max-w-[14rem] rounded-md border border-border/60 bg-card px-3 py-2 text-left shadow-raised',
        anchorClassName
      )}
    >
      <PinTooltipContent highlight={highlight} />
    </div>
  )
}

function useTooltipTrigger({
  useMobileTooltip,
  triggerRef,
}: {
  useMobileTooltip?: boolean
  triggerRef: Ref<HTMLElement>
}) {
  const [open, setOpen] = useState(false)
  const narrow = useNarrowViewport()
  const showFixedTooltip = Boolean(useMobileTooltip && narrow && open)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open || showFixedTooltip) return
    const onPointerDown = (e: PointerEvent) => {
      const el = triggerRef && 'current' in triggerRef ? triggerRef.current : null
      if (el?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, showFixedTooltip, close, triggerRef])

  return { open, setOpen, narrow, showFixedTooltip, close }
}

function PinOverlay({
  highlight,
  selected,
  onPinSelect,
  useMobileTooltip,
  layout,
}: {
  highlight: EvidenceHighlight
  selected?: boolean
  onPinSelect?: (flagId: string) => void
  useMobileTooltip?: boolean
  layout?: LetterboxLayout
}) {
  const pinRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, narrow, showFixedTooltip, close } = useTooltipTrigger({
    useMobileTooltip,
    triggerRef: pinRef,
  })
  const center = highlightCenter(highlight, layout)

  const handleClick = () => {
    onPinSelect?.(highlight.flagId)
    setOpen((prev) => !prev)
  }

  return (
    <>
      <div
        className="absolute z-[1]"
        style={{
          left: normalizedPercent(center.x),
          top: normalizedPercent(center.y),
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
        <EvidenceTooltip
          highlight={highlight}
          open={open}
          showFixedTooltip={showFixedTooltip}
          onClose={close}
          anchorClassName={cn(
            highlight.y > 0.55 ? 'bottom-full mb-2' : 'top-full mt-2',
            center.x > 0.5 ? 'right-0' : 'left-0'
          )}
        />
      </div>
    </>
  )
}

function PageEvidenceOverlay({
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, narrow, showFixedTooltip, close } = useTooltipTrigger({
    useMobileTooltip,
    triggerRef,
  })

  const handleClick = () => {
    onPinSelect?.(highlight.flagId)
    setOpen((prev) => !prev)
  }

  return (
    <div className="absolute inset-0 z-[1]">
      <button
        ref={triggerRef}
        type="button"
        className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset"
        aria-label={`Evidence: ${highlight.label}`}
        aria-expanded={open}
        aria-current={selected ? 'true' : undefined}
        onMouseEnter={() => !narrow && setOpen(true)}
        onMouseLeave={() => !narrow && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => !narrow && setOpen(false)}
        onClick={handleClick}
      />
      <EvidenceTooltip
        highlight={highlight}
        open={open}
        showFixedTooltip={showFixedTooltip}
        onClose={close}
        anchorClassName="left-1/2 top-4 -translate-x-1/2"
      />
    </div>
  )
}

function EvidenceInteractiveOverlay({
  highlight,
  selected,
  onPinSelect,
  useMobileTooltip,
  layout,
}: {
  highlight: EvidenceHighlight
  selected?: boolean
  onPinSelect?: (flagId: string) => void
  useMobileTooltip?: boolean
  layout?: LetterboxLayout
}) {
  if (highlight.scope === 'page') {
    return (
      <PageEvidenceOverlay
        highlight={highlight}
        selected={selected}
        onPinSelect={onPinSelect}
        useMobileTooltip={useMobileTooltip}
      />
    )
  }

  return (
    <PinOverlay
      highlight={highlight}
      selected={selected}
      onPinSelect={onPinSelect}
      useMobileTooltip={useMobileTooltip}
      layout={layout}
    />
  )
}

function EvidenceRegionGlow({
  highlight,
  selected,
  layout,
}: {
  highlight: EvidenceHighlight
  selected?: boolean
  layout?: LetterboxLayout
}) {
  const isCritical = highlight.severity === 'CRITICAL'
  const isPage = highlight.scope === 'page'
  const rect = layout ? mapHighlightToLetterbox(highlight, layout) : highlight

  if (isPage) {
    return (
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-[5px] transition-opacity duration-300',
          selected ? 'opacity-100' : 'opacity-0',
          'bg-brand/5'
        )}
        aria-hidden={!selected}
      />
    )
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute rounded-[5px] transition-opacity duration-300',
        selected ? 'opacity-100' : 'opacity-0',
        isCritical
          ? cn(
              'ring-[3px] ring-destructive',
              'bg-destructive/10 shadow-[0_0_0_1px_hsl(var(--destructive)/0.38),0_0_0_5px_hsl(var(--destructive)/0.12),0_12px_34px_hsl(var(--destructive)/0.28)]'
            )
          : cn(
              'ring-[3px] ring-brand',
              'bg-brand/10 shadow-[0_0_0_1px_hsl(var(--brand)/0.34),0_0_0_5px_hsl(var(--brand)/0.12),0_12px_34px_hsl(var(--peach-glow)/0.32)]'
            )
      )}
      style={{
        left: normalizedPercent(rect.x),
        top: normalizedPercent(rect.y),
        width: normalizedPercent(rect.width),
        height: normalizedPercent(rect.height),
      }}
      aria-hidden={!selected}
    />
  )
}

function RegionLayer({
  highlights,
  device,
  selectedFlagId,
  layout,
}: {
  highlights: EvidenceHighlight[]
  device: 'desktop' | 'mobile'
  selectedFlagId?: string
  layout?: LetterboxLayout
}) {
  const visible = highlights.filter((h) => h.device === device && h.flagId === selectedFlagId)
  if (visible.length === 0) return null

  return (
    <>
      {visible.map((h) => (
        <EvidenceRegionGlow key={h.id} highlight={h} selected layout={layout} />
      ))}
    </>
  )
}

function InteractiveLayer({
  highlights,
  device,
  selectedFlagId,
  onPinSelect,
  useMobileTooltip,
  layout,
}: {
  highlights: EvidenceHighlight[]
  device: 'desktop' | 'mobile'
  selectedFlagId?: string
  onPinSelect?: (flagId: string) => void
  useMobileTooltip?: boolean
  layout?: LetterboxLayout
}) {
  const visible = highlights.filter((h) => {
    if (h.device !== device) return false
    if (selectedFlagId && h.flagId !== selectedFlagId) return false
    // Selected element flags use the rectangle highlight only -- no center pin.
    if (selectedFlagId && h.flagId === selectedFlagId && h.scope === 'element') return false
    return true
  })
  if (visible.length === 0) return null

  return (
    <>
      {visible.map((h) => (
        <EvidenceInteractiveOverlay
          key={h.id}
          highlight={h}
          selected={h.flagId === selectedFlagId}
          onPinSelect={onPinSelect}
          useMobileTooltip={useMobileTooltip}
          layout={layout}
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
  comparisonState = 'neutral',
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
  comparisonState?: 'affected' | 'unaffected' | 'neutral'
}) {
  const resolvedImageUrl = normalizeInternalScreenshotUrl(imageUrl)
  const [imgError, setImgError] = useState(false)
  const [letterbox, setLetterbox] = useState<LetterboxLayout | undefined>()
  const panelRef = useRef<HTMLDivElement>(null)
  const panelStyle: CSSProperties = size
    ? { width: size.width, height: size.height, maxHeight: size.height, flexShrink: 0 }
    : viewportAspectStyle(device)

  const active = highlights.some((h) => h.device === device && h.flagId === selectedFlagId)

  const selectedPageHighlight = highlights.find(
    (h) => h.device === device && h.flagId === selectedFlagId && h.scope === 'page'
  )
  const pageBorderCritical = selectedPageHighlight?.severity === 'CRITICAL'
  const pageBorderSelected = Boolean(selectedPageHighlight)
  const resolvedComparisonState = imgError ? 'neutral' : comparisonState
  const comparisonLabel =
    resolvedComparisonState === 'affected'
      ? REPORT_COPY.reportFirst.affectedViewport(device)
      : resolvedComparisonState === 'unaffected'
        ? REPORT_COPY.reportFirst.unaffectedViewport
        : null
  const ComparisonIcon =
    resolvedComparisonState === 'affected' ? CircleAlert : CheckCircle2

  const updateLetterbox = useCallback(
    (img: HTMLImageElement) => {
      const panel = panelRef.current
      if (!panel || !img.naturalWidth || !img.naturalHeight) return
      const containerAspect = panel.clientWidth / panel.clientHeight
      const imageAspect = img.naturalWidth / img.naturalHeight
      setLetterbox(computeLetterboxLayout(imageAspect, containerAspect))
    },
    []
  )

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const observer = new ResizeObserver(() => {
      const img = panel.querySelector('img')
      if (img?.naturalWidth) updateLetterbox(img)
    })
    observer.observe(panel)
    return () => observer.disconnect()
  }, [updateLetterbox])

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node
      if (typeof containerRef === 'function') containerRef(node)
      else if (containerRef && 'current' in containerRef) {
        containerRef.current = node
      }
    },
    [containerRef]
  )

  return (
    <div
      ref={setRefs}
      className={cn(
        'relative overflow-hidden rounded-md bg-muted/30 shadow-card',
        pageBorderSelected && 'border-[3px]',
        pageBorderSelected && pageBorderCritical && 'border-destructive',
        pageBorderSelected && !pageBorderCritical && 'border-brand',
        resolvedComparisonState === 'affected' &&
          'ring-2 ring-destructive ring-offset-2 ring-offset-background',
        resolvedComparisonState === 'unaffected' &&
          'ring-2 ring-emerald-600 ring-offset-2 ring-offset-background',
        size ? 'shrink-0' : 'w-full',
        className
      )}
      style={panelStyle}
    >
      {comparisonLabel ? (
        <div
          className={cn(
            'absolute left-2 top-2 z-overlay inline-flex min-h-7 items-center gap-1.5 rounded-md border bg-background/95 px-2 py-1 text-2xs font-medium shadow-sm backdrop-blur',
            resolvedComparisonState === 'affected'
              ? 'border-destructive/40 text-destructive'
              : 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400'
          )}
        >
          <ComparisonIcon className="h-3.5 w-3.5" aria-hidden />
          {comparisonLabel}
        </div>
      ) : null}
      {imgError ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Screenshot unavailable
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={resolvedImageUrl}
          alt={`${device} screenshot of ${host}`}
          width={1440}
          height={900}
          loading="lazy"
          onLoad={(event) => updateLetterbox(event.currentTarget)}
          onError={() => setImgError(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-contain object-top transition-[filter] duration-300',
            active && 'brightness-[0.92]'
          )}
        />
      )}
      <div className="pointer-events-none absolute inset-0">
        <RegionLayer
          highlights={highlights}
          device={device}
          selectedFlagId={selectedFlagId}
          layout={letterbox}
        />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto relative h-full w-full">
          <InteractiveLayer
            highlights={highlights}
            device={device}
            selectedFlagId={selectedFlagId}
            onPinSelect={onPinSelect}
            useMobileTooltip={useMobileTooltip}
            layout={letterbox}
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
  affectedDevices,
  className,
}: ScreenshotWithHighlightsProps) {
  const showDesktopPanel = showDesktop && Boolean(desktopScreenshot)
  const showMobilePanel = showMobile && Boolean(mobileScreenshot)

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
          comparisonState={
            affectedDevices
              ? affectedDevices.includes('desktop')
                ? 'affected'
                : 'unaffected'
              : 'neutral'
          }
          useMobileTooltip
        />
      </div>
    )
  }

  if (!showDesktopPanel && showMobilePanel) {
    const mobileOnlySize = mobileViewportSizeForHeight(MOBILE_ONLY_PREVIEW_HEIGHT)

    return (
      <div className={cn('flex w-full justify-center', className)}>
        <ScreenshotPanel
          imageUrl={mobileScreenshot!}
          device="mobile"
          host={host}
          highlights={highlights}
          selectedFlagId={selectedFlagId}
          onPinSelect={onPinSelect}
          comparisonState={
            affectedDevices
              ? affectedDevices.includes('mobile')
                ? 'affected'
                : 'unaffected'
              : 'neutral'
          }
          size={mobileOnlySize}
          useMobileTooltip
        />
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="grid w-full min-w-0 grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1.422222fr)_minmax(0,0.461823fr)] sm:gap-6">
        <div className="min-w-0 flex-1">
          <ScreenshotPanel
            imageUrl={desktopScreenshot!}
            device="desktop"
            host={host}
            highlights={highlights}
            selectedFlagId={selectedFlagId}
            onPinSelect={onPinSelect}
            comparisonState={
              affectedDevices
                ? affectedDevices.includes('desktop')
                  ? 'affected'
                  : 'unaffected'
                : 'neutral'
            }
            useMobileTooltip
          />
        </div>
        <div className="mx-auto min-w-0 w-[32.4719%] sm:w-full">
          <ScreenshotPanel
            imageUrl={mobileScreenshot!}
            device="mobile"
            host={host}
            highlights={highlights}
            selectedFlagId={selectedFlagId}
            onPinSelect={onPinSelect}
            comparisonState={
              affectedDevices
                ? affectedDevices.includes('mobile')
                  ? 'affected'
                  : 'unaffected'
                : 'neutral'
            }
            useMobileTooltip
          />
        </div>
      </div>
    </div>
  )
}
