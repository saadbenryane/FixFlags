'use client'

import { useState } from 'react'
import { Globe2 } from 'lucide-react'

/** Decorative Site identity. A missing capture cannot change its recorded result. */
export function SiteCaptureThumb({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  return <span className={className} aria-hidden="true">
    {src && failed !== src ? (
      // Authorized captures use the current browser session.
      // eslint-disable-next-line @next/next/no-img-element
      <img key={src} src={src} alt="" width={176} height={128} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(src)} />
    ) : <Globe2 size={20} />}
  </span>
}
