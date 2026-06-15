'use client'

import Image from 'next/image'
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

  return (
    <div className={cn('relative aspect-[4/3] w-full overflow-hidden rounded-card', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
    </div>
  )
}
