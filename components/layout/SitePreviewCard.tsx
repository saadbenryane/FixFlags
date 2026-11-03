'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { useEffect, useRef, useState } from 'react'
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
  const [selectedDevice, setDevice] = useState<'desktop' | 'mobile' | null>(null)
  const device = selectedDevice ?? (captures.some(item => item.device === 'desktop') ? 'desktop' : captures[0]?.device ?? 'desktop')
  const showDevices = captures.length > 0 || availability?.desktop !== availability?.mobile
  const [open, setOpen] = useState(false)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const capture = captures.find(item => item.device === device)
  const dimensions = capture?.viewport.match(/^(\d+)\s*×\s*(\d+)$/)
  const width = Number(dimensions?.[1]) || 1280
  const height = Number(dimensions?.[2]) || 720
  const image = useRef<HTMLImageElement>(null)
  const available = capture && capture.url !== failedUrl
  const publicCapture = capture && /^\/marketing\/evidence\/[a-z0-9-]+\.(?:png|webp|jpg)$/.test(capture.url)
  useEffect(() => {
    if (capture && image.current?.complete && image.current.naturalWidth === 0) setFailedUrl(capture.url)
  }, [capture])
  return <section className={styles.card} data-device={device} aria-label={C.preview}>
    {showDevices ? <div className={styles.devices}>
      {(['desktop', 'mobile'] as const).map(value => <Button key={value} type="button" variant={device === value ? 'secondary' : 'ghost'} size="icon" aria-label={C[value]} title={C[value]} aria-pressed={device === value} onClick={() => { setDevice(value); setFailedUrl(null) }}>
        {value === 'desktop' ? <Monitor size={16} aria-hidden /> : <Smartphone size={16} aria-hidden />}
      </Button>)}
    </div> : null}
    {available ? <InteractiveButton ref={opener} type="button" className={styles.imageButton} style={device === 'desktop' ? { aspectRatio: `${width} / ${height}` } : undefined} aria-label={C.openCapture(host)} onClick={() => setOpen(true)}>
      {publicCapture ? <Image ref={image} src={capture.url} alt="" width={width} height={height}
        sizes="(max-width: 639px) 100vw, (max-width: 1024px) 50vw, 640px" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async"
        onError={() => setFailedUrl(capture.url)} data-device={device} /> :
        // Private captures use the viewer's session and cannot use the public optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={image} src={capture.url} alt="" width={width} height={height} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async"
          onError={() => setFailedUrl(capture.url)} data-device={device} />}
      <span className={styles.enlarge}><Maximize2 size={16} aria-hidden /></span>
    </InteractiveButton> : <div className={`${styles.empty} ${!showDevices ? styles.emptySolo : ''}`}><Globe2 size={24} aria-hidden /><p role="status">{capture || availability?.[device] === 'unavailable' ? C.captureUnavailable : availability?.[device] === 'pending' ? C.capturePending : C.noCapture}</p></div>}
    {available && capture.previous ? <p className="px-4 pb-3 text-xs text-muted-foreground">{C.previousCapture} · {capture.recordedAt ? formatEvidenceTimestamp(capture.recordedAt) : C.timeUnknown}
      {availability?.[device] === 'pending' ? ` · ${C.capturePending}` : availability?.[device] === 'unavailable' ? ` · ${C.latestCaptureUnavailable}` : ''}</p> : null}
    {capture ? <ResponsiveDepth header={<DialogTitle>{host}</DialogTitle>} open={open} onOpenChange={setOpen} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }} className="max-w-4xl">
      <DialogDescription>{capture.previous ? C.previousCapture : C.latestCapture} · {capture.pageUrl} · {capture.viewport} · {capture.recordedAt ? formatEvidenceTimestamp(capture.recordedAt) : C.timeUnknown}</DialogDescription>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={capture.url} alt={C.openCapture(host)} width={width} height={height} className="h-auto max-w-full" />
    </ResponsiveDepth> : null}
  </section>
}
