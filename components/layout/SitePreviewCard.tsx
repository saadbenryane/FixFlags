'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Globe2, Maximize2, Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { SITE_WORKSPACE_COPY as C } from '@/lib/marketing/copy/workspace'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import type { SiteCapture } from '@/lib/sites/captures'
import type { SiteCaptureAvailability } from '@/lib/sites/captures'
export type { SiteCapture } from '@/lib/sites/captures'
import styles from './SitePreviewCard.module.css'

export function SitePreviewCard({ host, captures, availability, priority = false }: {
  host: string; captures: readonly SiteCapture[]; availability?: SiteCaptureAvailability; priority?: boolean
}) {
  return <SitePreviewContent key={host} host={host} captures={captures} availability={availability} priority={priority} />
}

function captureDimensions(capture: SiteCapture | null | undefined) {
  const dimensions = capture?.viewport.match(/^(\d+)\s*×\s*(\d+)$/)
  return { width: Number(dimensions?.[1]) || 1280, height: Number(dimensions?.[2]) || 720 }
}

function SitePreviewContent({ host, captures, availability, priority }: Parameters<typeof SitePreviewCard>[0]) {
  const [selectedDevice, setDevice] = useState<'desktop' | 'mobile' | null>(null)
  const device = selectedDevice ?? (captures.some(item => item.device === 'desktop') ? 'desktop' : captures[0]?.device ?? 'desktop')
  const showDevices = captures.length > 0 || availability?.desktop !== availability?.mobile
  const [inspection, setInspection] = useState<{ capture: SiteCapture; failed: boolean; attempt: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<{ url: string; attempt: number } | null>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const focusAfterRetry = useRef(false)
  const root = useRef<HTMLElement>(null)
  const capture = captures.find(item => item.device === device)
  const { width, height } = captureDimensions(capture)
  const inspected = inspection?.capture
  const inspectedDimensions = captureDimensions(inspected)
  const latestInspectedDevice = inspected && captures.find(item => item.device === inspected.device)
  const inspectedPrevious = inspected?.previous || latestInspectedDevice?.previous ||
    latestInspectedDevice?.url !== inspected?.url || latestInspectedDevice?.auditId !== inspected?.auditId
  const image = useRef<HTMLImageElement>(null)
  const available = capture && !(failure?.url === capture.url && failure.attempt === attempt)
  const publicCapture = capture && /^\/marketing\/evidence\/[a-z0-9-]+\.(?:png|webp|jpg)$/.test(capture.url)
  useEffect(() => {
    if (capture && image.current?.complete && image.current.naturalWidth === 0) setFailure({ url: capture.url, attempt })
  }, [capture, attempt])
  useLayoutEffect(() => {
    if (focusAfterRetry.current) { focusAfterRetry.current = false; opener.current?.focus() }
  }, [attempt])
  return <section ref={root} tabIndex={-1} className={styles.card} data-device={device} aria-label={C.preview}>
    {showDevices ? <div className={styles.devices}>
      {(['desktop', 'mobile'] as const).map(value => <Button key={value} type="button" variant={device === value ? 'secondary' : 'ghost'} size="icon" aria-label={C[value]} title={C[value]} aria-pressed={device === value} onClick={() => { setDevice(value); setFailure(null) }}>
        {value === 'desktop' ? <Monitor size={16} aria-hidden /> : <Smartphone size={16} aria-hidden />}
      </Button>)}
    </div> : null}
    {available ? <InteractiveButton ref={opener} type="button" className={styles.imageButton} style={device === 'desktop' ? { aspectRatio: `${width} / ${height}` } : undefined} aria-label={C.openCapture(host)} onClick={() => setInspection({ capture: { ...capture }, failed: false, attempt: 0 })}>
      {publicCapture ? <Image key={`${capture.url}:${attempt}`} ref={image} src={capture.url} alt="" width={width} height={height}
        sizes="(max-width: 639px) 100vw, (max-width: 1024px) 50vw, 640px" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async"
        onError={() => setFailure({ url: capture.url, attempt })} data-device={device} /> :
        // Private captures use the viewer's session and cannot use the public optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${capture.url}:${attempt}`} ref={image} src={capture.url} alt="" width={width} height={height} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async"
          onError={() => setFailure({ url: capture.url, attempt })} data-device={device} />}
      <span className={styles.enlarge}><Maximize2 size={16} aria-hidden /></span>
    </InteractiveButton> : <div className={`${styles.empty} ${!showDevices ? styles.emptySolo : ''}`}><Globe2 size={24} aria-hidden /><div><p role="status">{capture || availability?.[device] === 'unavailable' ? C.captureUnavailable : availability?.[device] === 'pending' ? C.capturePending : C.noCapture}</p>
      {capture ? <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => { focusAfterRetry.current = true; setFailure(null); setAttempt(value => value + 1) }}>{C.retryCapture}</Button> : null}</div></div>}
    {available && capture.previous ? <p className="px-4 pb-3 text-xs text-muted-foreground">{C.previousCapture} · {capture.recordedAt ? formatEvidenceTimestamp(capture.recordedAt) : C.timeUnknown}
      {availability?.[device] === 'pending' ? ` · ${C.capturePending}` : availability?.[device] === 'unavailable' ? ` · ${C.latestCaptureUnavailable}` : ''}</p> : null}
    <ResponsiveDepth header={<DialogTitle>{host}</DialogTitle>} open={Boolean(inspection)} onOpenChange={open => { if (!open) setInspection(null) }} onCloseAutoFocus={event => { event.preventDefault(); (opener.current ?? root.current)?.focus() }} className="max-w-4xl">
      {inspected ? <><DialogDescription>{inspectedPrevious ? C.previousCapture : C.latestCapture} · {inspected.pageUrl} · {inspected.viewport} · {inspected.recordedAt ? formatEvidenceTimestamp(inspected.recordedAt) : C.timeUnknown}</DialogDescription>
        {inspection?.failed ? (
          <div className="space-y-3">
            <p role="status" className="text-sm text-muted-foreground">{C.captureUnavailable}</p>
            <Button type="button" variant="outline" onClick={() => setInspection(current => current ? { ...current, failed: false, attempt: current.attempt + 1 } : null)}>{C.retryCapture}</Button>
          </div>
        ) : <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={inspection?.attempt} src={inspected.url} alt={C.openCapture(host)} width={inspectedDimensions.width} height={inspectedDimensions.height} className="h-auto max-w-full" onError={() => setInspection(current => current && current === inspection ? { ...current, failed: true } : current)} />
        </>}
      </> : null}
    </ResponsiveDepth>
  </section>
}
