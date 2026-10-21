import Image from 'next/image'
import { BRAND } from '@/lib/marketing/copy/brand'
import { cn } from '@/lib/utils'

export type LogoVariant = 'wordmark' | 'mark' | 'lockup'

/** The cleaned owner mark stays sharp at every display density. */
const MARK = {
  sm: { width: 15, height: 24 },
  md: { width: 17, height: 28 },
  lg: { width: 20, height: 32 },
} as const

const WORD_CLASS = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
} as const

type LogoSize = keyof typeof MARK

interface LogoProps {
  variant?: LogoVariant
  size?: LogoSize
  className?: string
  href?: string
}

function Mark({ size }: { size: LogoSize }) {
  const asset = MARK[size]
  return (
    <Image
      src="/brand/logo-mark.svg"
      alt=""
      width={asset.width}
      height={asset.height}
      unoptimized
      className="shrink-0 object-contain"
      style={{ width: asset.width, height: asset.height }}
    />
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
    <span
      className={cn(
        'inline-flex min-w-max items-center gap-1.5 overflow-visible whitespace-nowrap text-foreground',
        className
      )}
    >
      {variant === 'wordmark' ? (
        <Wordmark size={size} />
      ) : variant === 'mark' ? (
        <Mark size={size} />
      ) : (
        <>
          <Mark size={size} />
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
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center overflow-visible rounded-sm px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {content}
      </a>
    )
  }

  return content
}
