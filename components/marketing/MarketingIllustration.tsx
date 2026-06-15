'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type MarketingIllustrationVariant = 'hero' | 'steps' | 'proof'

const VARIANT_PATHS: Record<MarketingIllustrationVariant, string> = {
  hero: '/marketing/hero.webp',
  steps: '/marketing/steps.webp',
  proof: '/marketing/proof.webp',
}

export function MarketingIllustration({
  variant,
  alt,
  className,
  priority = false,
}: {
  variant: MarketingIllustrationVariant
  alt: string
  className?: string
  priority?: boolean
}) {
  const src = VARIANT_PATHS[variant]
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(src, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled) setAvailable(res.ok)
      })
      .catch(() => {
        if (!cancelled) setAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [src])

  return (
    <div className={cn('relative aspect-[4/3] w-full overflow-hidden rounded-card', className)}>
      {available ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      ) : (
        <div
          aria-hidden={alt ? undefined : true}
          className="absolute inset-0 border border-dashed border-border/40 bg-muted/20"
        />
      )}
    </div>
  )
}
