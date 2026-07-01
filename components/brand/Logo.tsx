import { BRAND } from '@/lib/marketing/copy'
import { BRAND_HEX } from '@/lib/design/brand-spec'
import { cn } from '@/lib/utils'

export type LogoVariant = 'wordmark' | 'mark' | 'lockup'

const MARK_PX = { sm: 24, md: 30, lg: 38 } as const
const TEXT_CLASS = { sm: 'text-lg', md: 'text-xl', lg: 'text-[1.75rem]' } as const

type LogoSize = keyof typeof MARK_PX

interface LogoProps {
  variant?: LogoVariant
  size?: LogoSize
  className?: string
  href?: string
}

/**
 * FixFlags mark: a clean waving flag — rounded orange flagpole flying a soft
 * wavy pennant. Flat, optically balanced. Per the Final Brand Guideline.
 */
function Mark({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden
    >
      <rect x="9.5" y="4" width="5" height="40" rx="2.5" fill={BRAND_HEX.primary} />
      <path
        d="M14.5 6C23 2.5 30 10 41 6C39 12 39 18.5 41 24.5C30 28.5 23 21 14.5 25Z"
        fill={BRAND_HEX.primary}
      />
    </svg>
  )
}

export function Logo({ variant = 'lockup', size = 'md', className, href }: LogoProps) {
  const showText = variant !== 'mark'

  const content = (
    <span className={cn('inline-flex items-center gap-2.5 text-foreground', className)}>
      <Mark px={MARK_PX[size]} />
      {showText && (
        <span
          className={cn(
            'font-serif font-medium leading-none tracking-[-0.01em] text-foreground',
            TEXT_CLASS[size]
          )}
        >
          {BRAND.name}
        </span>
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
