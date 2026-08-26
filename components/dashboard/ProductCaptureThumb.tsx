'use client'

import { useState } from 'react'
import { Globe2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProductCaptureThumb({
  src,
  className,
}: {
  src: string | null
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <div
      className={cn(
        'relative h-[5.25rem] w-[7.5rem] shrink-0 overflow-hidden rounded-[var(--radius-nested-md)] bg-muted/50 shadow-sm ring-1 ring-black/10 dark:ring-white/10',
        className,
      )}
    >
      {showImage ? (
        // Authenticated screenshot bytes cannot go through next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          width={1280}
          height={900}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div
          className="grid h-full w-full place-items-center text-muted-foreground"
          aria-hidden
        >
          <Globe2 className="h-5 w-5" />
        </div>
      )}
    </div>
  )
}
