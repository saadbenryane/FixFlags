import Image from 'next/image'
import { BRAND } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export type LogoVariant = 'wordmark' | 'mark' | 'lockup'

const MARK_PX = { sm: 24, md: 28, lg: 32 } as const
const WORD_CLASS = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
} as const

type LogoSize = keyof typeof MARK_PX

interface LogoProps {
  variant?: LogoVariant
  size?: LogoSize
  className?: string
  href?: string
}

function Mark({ px }: { px: number }) {
  return (
    <span className="relative block shrink-0" style={{ width: px, height: px }}>
      <Image
        src="/brand/logo-mark.png"
        alt=""
        fill
        sizes={`${px}px`}
        // Already-compressed brand PNG; skip /_next/image so a localPatterns
        // allowlist regression cannot blank the live logo.
        unoptimized
        className="object-contain"
      />
    </span>
  )
}

function Wordmark({ size }: { size: LogoSize }) {
  return (
    <span
      className={cn(
        'font-display tracking-heading text-foreground',
        WORD_CLASS[size]
      )}
      aria-hidden
    >
      <span className="font-bold">Fix</span>
      <span className="font-semibold">Flags</span>
    </span>
  )
}

export function Logo({ variant = 'lockup', size = 'md', className, href }: LogoProps) {
  const content = (
    <span className={cn('inline-flex items-center gap-2 text-foreground', className)}>
      {variant === 'wordmark' ? (
        <Wordmark size={size} />
      ) : variant === 'mark' ? (
        <Mark px={MARK_PX[size]} />
      ) : (
        <>
          <Mark px={MARK_PX[size]} />
          <Wordmark size={size} />
        </>
      )}
    </span>
  )

  if (href) {
    return (
      <a
        href={href}
        aria-label={BRAND.name}
        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {content}
      </a>
    )
  }

  return content
}
