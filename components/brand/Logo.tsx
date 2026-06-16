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
 * FixFlags mark: equalizer with a flag at center. Pattern (L→R): short bar,
 * tall bar, [orange flagpole + pennant], tall bar, short bar. Bars use
 * currentColor so they invert with the theme (Ink in light, white in dark);
 * the center pole + flag stay Flag orange. Traced from the official UI Kit art.
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
      <rect x="0.5" y="15" width="5" height="18" rx="1.6" fill="currentColor" />
      <rect x="10.5" y="8" width="5" height="32" rx="1.6" fill="currentColor" />
      <rect x="32.5" y="8" width="5" height="32" rx="1.6" fill="currentColor" />
      <rect x="42.5" y="15" width="5" height="18" rx="1.6" fill="currentColor" />
      <rect x="21.5" y="4" width="5" height="43" rx="1.6" fill={BRAND_HEX.primary} />
      <path d="M21.5 4 L21.5 0.5 L33 4.5 L26.5 9 Z" fill={BRAND_HEX.primary} />
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
