import Image from 'next/image'
import { cn } from '@/lib/utils'

const ILLUSTRATIONS = {
  flag: {
    src: '/marketing/brand-glass-flag.webp',
    width: 733,
    height: 1100,
    position: 'object-[50%_58%]',
  },
  moments: {
    src: '/marketing/brand-product-moments.webp',
    width: 1500,
    height: 641,
    position: 'object-left',
  },
} as const

interface BrandIllustrationProps {
  variant?: keyof typeof ILLUSTRATIONS
  className?: string
  imageClassName?: string
  priority?: boolean
  sizes?: string
  /** `soft` thins the canvas veil so the asset can dissolve into the peach mesh. */
  veil?: 'default' | 'soft'
}

const VEIL = {
  default:
    'absolute inset-0 bg-[linear-gradient(145deg,hsl(var(--background)/0.04),hsl(var(--background)/0.34)_72%,hsl(var(--background)/0.7))]',
  soft: 'absolute inset-0 bg-[linear-gradient(145deg,hsl(var(--background)/0.02),hsl(var(--background)/0.18)_68%,hsl(var(--background)/0.42))]',
} as const

export function BrandIllustration({
  variant = 'flag',
  className,
  imageClassName,
  priority = false,
  sizes = '280px',
  veil = 'default',
}: BrandIllustrationProps) {
  const illustration = ILLUSTRATIONS[variant]

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none relative isolate overflow-hidden', className)}
    >
      <Image
        alt=""
        src={illustration.src}
        fill
        priority={priority}
        sizes={sizes}
        className={cn('object-cover', illustration.position, imageClassName)}
      />
      <div className={VEIL[veil]} />
    </div>
  )
}
