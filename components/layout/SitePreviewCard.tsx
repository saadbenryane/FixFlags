'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe2, Maximize2 } from 'lucide-react'
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
  const image = useRef<HTMLImageElement>(null)
  const available = capture && capture.url !== failedUrl
  useEffect(() => {
    if (capture && image.current?.complete && image.current.naturalWidth === 0) setFailedUrl(capture.url)
  }, [capture])
  return <section className={styles.card} aria-label={C.preview}>
    <div className={styles.header}><h2>{C.preview}</h2><div className={styles.devices}>
      {(['desktop', 'mobile'] as const).map(value => <Button key={value} variant={device === value ? 'secondary' : 'ghost'} size="sm" aria-pressed={device === value} onClick={() => { setDevice(value); setFailedUrl(null) }}>{C[value]}</Button>)}
    </div></div>
    {available ? <button ref={opener} type="button" className={styles.imageButton} aria-label={C.openCapture(host)} onClick={() => setOpen(true)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={image} src={capture.url} alt="" width={1280} height={720} onError={() => setFailedUrl(capture.url)} data-device={device} />
      <span className={styles.enlarge}><Maximize2 size={16} aria-hidden /></span>
    </button> : <div className={styles.empty}><Globe2 size={24} aria-hidden /><p>{capture ? C.captureUnavailable : C.noCapture}</p></div>}
    {capture ? <div className={styles.caption}><span>{capture.previous ? C.previousCapture : C.latestCapture}</span><time dateTime={capture.recordedAt ?? undefined}>{capture.recordedAt ? formatEvidenceTimestamp(capture.recordedAt) : C.timeUnknown}</time><span className={styles.pageUrl}>{capture.pageUrl}</span></div> : null}
    {capture ? <ResponsiveDepth open={open} onOpenChange={setOpen} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }} className="max-w-4xl">
      <DialogTitle>{host}</DialogTitle><DialogDescription>{capture.pageUrl} · {capture.viewport}{capture.recordedAt ? ` · ${formatEvidenceTimestamp(capture.recordedAt)}` : ''}</DialogDescription>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={capture.url} alt={C.openCapture(host)} width={1280} height={720} className="h-auto max-w-full" />
    </ResponsiveDepth> : null}
  </section>
}
