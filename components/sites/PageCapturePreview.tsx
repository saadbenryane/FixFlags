'use client'

import { useState } from 'react'
import { Globe2 } from 'lucide-react'
import { BOARD_PREVIEW_COPY as C } from '@/lib/marketing/copy/board-preview'
import { SITE_WORKSPACE_COPY as W } from '@/lib/marketing/copy/workspace'
import styles from './PageCapturePreview.module.css'

export function PageCapturePreview({ page, capture }: { page: string; capture?: { src: string; alt: string } | null }) {
  const [failed, setFailed] = useState<string | null>(null)
  const unavailable = capture ? W.captureUnavailable : C.noPageCapture
  return capture && failed !== capture.src ? <a className={styles.preview} href={capture.src} target="_blank" rel="noopener noreferrer" aria-label={C.pagePreview(page)}>
    {/* Page captures use the viewer's session through the screenshot route. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={capture.src} alt={capture.alt} width={1280} height={720} loading="lazy" onError={() => setFailed(capture.src)} />
  </a> : <div className={styles.empty} role="img" aria-label={`${C.pagePreview(page)}: ${unavailable}`}><Globe2 size={20} aria-hidden /><span>{unavailable}</span></div>
}
