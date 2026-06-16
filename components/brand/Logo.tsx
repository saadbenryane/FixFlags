import { BRAND } from '@/lib/marketing/copy'
import { BRAND_HEX } from '@/lib/design/brand-spec'
import { cn } from '@/lib/utils'

export type LogoVariant = 'wordmark' | 'mark' | 'lockup'
export type LogoTheme = 'light' | 'dark' | 'auto'

const MARK_PX = { sm: 24, md: 30, lg: 38 } as const
const TEXT_CLASS = { sm: 'text-lg', md: 'text-xl', lg: 'text-[1.75rem]' } as const

type LogoSize = keyof typeof MARK_PX

interface LogoProps {
  variant?: LogoVariant
  /** Retained for API compatibility; mark bars follow currentColor (theme). */
  theme?: LogoTheme
  size?: LogoSize
  className?: string
  href?: string
}

/**
 * FixFlags mark: seven-bar equalizer. Bars use currentColor so they invert
 * with the theme (Ink in light, white in dark); center flagpole stays Flag orange.
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
      <rect x="1" y="16" width="4" height="16" rx="2" fill="currentColor" />
      <rect x="8" y="10" width="4" height="28" rx="2" fill="currentColor" />
      <rect x="15" y="16" width="4" height="16" rx="2" fill="currentColor" />
      <rect x="29" y="16" width="4" height="16" rx="2" fill="currentColor" />
      <rect x="36" y="10" width="4" height="28" rx="2" fill="currentColor" />
      <rect x="43" y="16" width="4" height="16" rx="2" fill="currentColor" />
      <rect x="22" y="14" width="4" height="30" rx="2" fill={BRAND_HEX.primary} />
      <path d="M22 7 L32 12.5 L24.5 16.5 Z" fill={BRAND_HEX.primary} />
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
            'font-sans font-bold leading-none tracking-[-0.02em] text-foreground',
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
