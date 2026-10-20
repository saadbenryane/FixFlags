'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Globe2, Maximize2, Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from '@/components/sites/ResponsiveDepth'
import { SITE_WORKSPACE_COPY as C } from '@/lib/marketing/copy/workspace'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import type { SiteCapture } from '@/lib/sites/captures'
export type { SiteCapture } from '@/lib/sites/captures'
import styles from './SitePreviewCard.module.css'

export function SitePreviewCard({ host, captures }: { host: string; captures: readonly SiteCapture[] }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
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
  return <section className={styles.card} aria-label={C.preview}>
    <div className={styles.devices}>
      {(['desktop', 'mobile'] as const).map(value => <Button key={value} type="button" variant={device === value ? 'secondary' : 'ghost'} size="icon" aria-label={C[value]} title={C[value]} aria-pressed={device === value} onClick={() => { setDevice(value); setFailedUrl(null) }}>
        {value === 'desktop' ? <Monitor size={16} aria-hidden /> : <Smartphone size={16} aria-hidden />}
      </Button>)}
    </div>
    {available ? <button ref={opener} type="button" className={styles.imageButton} aria-label={C.openCapture(host)} onClick={() => setOpen(true)}>
      {publicCapture ? <Image ref={image} src={capture.url} alt="" width={width} height={height}
        sizes="(max-width: 639px) 100vw, (max-width: 1024px) 50vw, 640px" loading="lazy" decoding="async"
        onError={() => setFailedUrl(capture.url)} data-device={device} /> :
        // Private captures use the viewer's session and cannot use the public optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={image} src={capture.url} alt="" width={width} height={height} loading="lazy" decoding="async"
          onError={() => setFailedUrl(capture.url)} data-device={device} />}
      <span className={styles.enlarge}><Maximize2 size={16} aria-hidden /></span>
    </button> : <div className={styles.empty}><Globe2 size={24} aria-hidden /><p>{capture ? C.captureUnavailable : C.noCapture}</p></div>}
    {capture ? <ResponsiveDepth header={<DialogTitle>{host}</DialogTitle>} open={open} onOpenChange={setOpen} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }} className="max-w-4xl">
      <DialogDescription>{capture.previous ? C.previousCapture : C.latestCapture} · {capture.pageUrl} · {capture.viewport} · {capture.recordedAt ? formatEvidenceTimestamp(capture.recordedAt) : C.timeUnknown}</DialogDescription>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={capture.url} alt={C.openCapture(host)} width={width} height={height} className="h-auto max-w-full" />
    </ResponsiveDepth> : null}
  </section>
}
