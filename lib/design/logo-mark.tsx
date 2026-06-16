import { BRAND_HEX } from '@/lib/design/brand-spec'

type LogoMarkProps = {
  barColor?: string
  flagColor?: string
  width?: number
  height?: number
}

/**
 * FixFlags mark: seven-bar equalizer.
 * Pattern (L→R): short, tall, short, [orange flagpole], short, tall, short.
 * Center orange bar runs tallest, extends below the others, flag points up-right.
 */
export function LogoMarkSvg({
  barColor = BRAND_HEX.foreground,
  flagColor = BRAND_HEX.primary,
  width = 40,
  height = 40,
}: LogoMarkProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="16" width="4" height="16" rx="2" fill={barColor} />
      <rect x="8" y="10" width="4" height="28" rx="2" fill={barColor} />
      <rect x="15" y="16" width="4" height="16" rx="2" fill={barColor} />
      <rect x="29" y="16" width="4" height="16" rx="2" fill={barColor} />
      <rect x="36" y="10" width="4" height="28" rx="2" fill={barColor} />
      <rect x="43" y="16" width="4" height="16" rx="2" fill={barColor} />
      <rect x="22" y="14" width="4" height="30" rx="2" fill={flagColor} />
      <path d="M22 7 L32 12.5 L24.5 16.5 Z" fill={flagColor} />
    </svg>
  )
}
