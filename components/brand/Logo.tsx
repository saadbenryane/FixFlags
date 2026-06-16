import { BRAND } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export type LogoVariant = 'wordmark' | 'mark' | 'lockup'
export type LogoTheme = 'light' | 'dark' | 'auto'

const SIZE_MAP = {
  sm: { mark: 24, wordmark: { width: 100, height: 24 } },
  md: { mark: 32, wordmark: { width: 120, height: 28 } },
  lg: { mark: 40, wordmark: { width: 140, height: 32 } },
} as const

type LogoSize = keyof typeof SIZE_MAP

interface LogoProps {
  variant?: LogoVariant
  theme?: LogoTheme
  size?: LogoSize
  className?: string
  href?: string
}

function LogoImage({
  variant,
  theme,
  size,
  className,
}: {
  variant: LogoVariant
  theme: 'light' | 'dark'
  size: LogoSize
  className?: string
}) {
  const dimensions = SIZE_MAP[size]
  const isMark = variant === 'mark' || variant === 'lockup'
  const src = isMark ? `/brand/mark-${theme}.svg` : `/brand/wordmark-${theme}.svg`
  const width = isMark ? dimensions.mark : dimensions.wordmark.width
  const height = isMark ? dimensions.mark : dimensions.wordmark.height

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={BRAND.name}
      width={width}
      height={height}
      className={cn('shrink-0', className)}
    />
  )
}

export function Logo({
  variant = 'wordmark',
  theme = 'auto',
  size = 'md',
  className,
  href,
}: LogoProps) {
  const content =
    theme === 'auto' ? (
      <span className={cn('inline-flex shrink-0', className)}>
        <LogoImage variant={variant} theme="light" size={size} className="dark:hidden" />
        <LogoImage variant={variant} theme="dark" size={size} className="hidden dark:block" />
      </span>
    ) : (
      <LogoImage variant={variant} theme={theme} size={size} className={className} />
    )

  if (href) {
    return (
      <a
        href={href}
        className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </a>
    )
  }

  return content
}
