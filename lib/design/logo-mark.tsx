import { BRAND_HEX } from '@/lib/design/brand-spec'

type LogoMarkProps = {
  barColor?: string
  flagColor?: string
  width?: number
  height?: number
}

/**
 * FixFlags mark: an equalizer with a flag at its center.
 * Pattern (L→R): short bar, tall bar, [orange flagpole + pennant], tall bar, short bar.
 * The center pole is the tallest element, extends below the bars, and flies a
 * right-pointing flag from its top. Geometry traced from the official UI Kit v2.0 art.
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
      <rect x="0.5" y="15" width="5" height="18" rx="1.6" fill={barColor} />
      <rect x="10.5" y="8" width="5" height="32" rx="1.6" fill={barColor} />
      <rect x="32.5" y="8" width="5" height="32" rx="1.6" fill={barColor} />
      <rect x="42.5" y="15" width="5" height="18" rx="1.6" fill={barColor} />
      <rect x="21.5" y="4" width="5" height="43" rx="1.6" fill={flagColor} />
      <path d="M21.5 4 L21.5 0.5 L33 4.5 L26.5 9 Z" fill={flagColor} />
    </svg>
  )
}
