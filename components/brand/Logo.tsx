import Image from 'next/image'
import { BRAND } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export type LogoVariant = 'wordmark' | 'mark' | 'lockup'

const MARK_PX = { sm: 24, md: 30, lg: 38 } as const
const LOCKUP_PX = { sm: 110, md: 138, lg: 174 } as const

type LogoSize = keyof typeof MARK_PX

interface LogoProps {
  variant?: LogoVariant
  size?: LogoSize
  className?: string
  href?: string
}

function Mark({ px }: { px: number }) {
  return (
    <span className="relative block" style={{ width: px, height: px }}>
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

export function Logo({ variant = 'lockup', size = 'md', className, href }: LogoProps) {
  const showLockup = variant !== 'mark'

  const lockupHeight = Math.round(LOCKUP_PX[size] * (382 / 1360))

  const content = (
    <span className={cn('inline-flex items-center text-foreground', className)}>
      {showLockup ? (
        <>
          <Image
            src="/brand/logo-lockup-light.png"
            alt=""
            width={LOCKUP_PX[size]}
            height={lockupHeight}
            priority={size !== 'sm'}
            unoptimized
            className="block object-contain dark:hidden"
          />
          <Image
            src="/brand/logo-lockup-dark.png"
            alt=""
            width={LOCKUP_PX[size]}
            height={lockupHeight}
            priority={size !== 'sm'}
            unoptimized
            className="hidden object-contain dark:block"
          />
        </>
      ) : (
        <Mark px={MARK_PX[size]} />
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
