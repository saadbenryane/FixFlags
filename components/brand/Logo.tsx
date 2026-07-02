import Image from 'next/image'
import { BRAND } from '@/lib/marketing/copy'
import { LogoMarkSvg } from '@/lib/design/logo-mark'
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
  return <LogoMarkSvg width={px} height={px} />
}

export function Logo({ variant = 'lockup', size = 'md', className, href }: LogoProps) {
  const showLockup = variant !== 'mark'

  const content = (
    <span className={cn('inline-flex items-center text-foreground', className)}>
      {showLockup ? (
        <span className="relative block" style={{ width: LOCKUP_PX[size], aspectRatio: '1360 / 382' }}>
          <Image
            src="/brand/logo-lockup-light.png"
            alt=""
            fill
            priority={size !== 'sm'}
            sizes={`${LOCKUP_PX[size]}px`}
            className="object-contain dark:hidden"
          />
          <Image
            src="/brand/logo-lockup-dark.png"
            alt=""
            fill
            priority={size !== 'sm'}
            sizes={`${LOCKUP_PX[size]}px`}
            className="hidden object-contain dark:block"
          />
        </span>
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
        className="inline-flex shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </a>
    )
  }

  return content
}
